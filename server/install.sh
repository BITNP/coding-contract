#!/bin/sh
set -eu
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
source_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if [ ! -f /etc/pioneer/api.env ]; then
  echo '请先配置 /etc/pioneer/api.env 中的 OIDC 参数，再运行安装脚本。' >&2
  exit 1
fi

sh "$source_root/server/provision.sh"

tools=/opt/pioneer/tools
app=/opt/pioneer/app
mkdir -p "$tools" "$app" /etc/pioneer
node_version=24.22.2

case "$(dpkg --print-architecture)" in
  arm64)
    node_arch=arm64
    node_hash=eb187837a2230d4047161ac0be008584e16b46f726e9c9490ee35dc6b17d9ba8
    ;;
  amd64)
    node_arch=x64
    node_hash=48cc0e21e048790e54c0cf5749c2725005313d652651c40b7a21feb9697aaf75
    ;;
esac

node_dir="$tools/node-$node_version"
if [ ! -x "$node_dir/bin/node" ]; then
  stage=$(mktemp -d "$tools/.node.XXXXXX")
  trap 'rm -rf "$stage"' EXIT
  curl -fL --retry 3 "https://nodejs.org/dist/v$node_version/node-v$node_version-linux-$node_arch.tar.xz" -o "$stage/node.tar.xz"
  printf '%s  %s\n' "$node_hash" "$stage/node.tar.xz" | sha256sum -c -
  mkdir "$stage/toolchain"
  tar -xJf "$stage/node.tar.xz" -C "$stage/toolchain" --strip-components=1
  mv "$stage/toolchain" "$node_dir"
  rm -rf "$stage"
  trap - EXIT
fi

ln -sfn "$node_dir" "$tools/node"
export PATH="$tools/node/bin:$tools/pnpm/bin:$PATH"
export npm_config_userconfig=/dev/null
export npm_config_globalconfig="$tools/npmrc"
export npm_config_cache="$tools/npm-cache"
export npm_config_registry=https://registry.npmjs.org
touch "$npm_config_globalconfig"
pnpm_version=$(node -p "require(process.argv[1]).packageManager.split('@')[1]" "$source_root/server/package.json")
if [ ! -x "$tools/pnpm/bin/pnpm" ] || [ "$(pnpm --version)" != "$pnpm_version" ]; then
  npm install --global --prefix "$tools/pnpm" --no-audit --no-fund "pnpm@$pnpm_version"
fi

rsync -a --delete --exclude node_modules --exclude data --exclude .env "$source_root/server/" "$app/server/"
rsync -a --delete "$source_root/shared/" "$app/shared/"
CI=true pnpm --dir "$app/server" --ignore-workspace install --prod --frozen-lockfile --store-dir "$tools/pnpm-store"
api_url=$(cd "$app/server" && node --input-type=module -e '
  import { readFileSync } from "node:fs"
  import { parseEnv } from "node:util"
  import { authConfig } from "./auth.js"
  const env = parseEnv(readFileSync("/etc/pioneer/api.env", "utf8"))
  authConfig({ ...env, NODE_ENV: "production" })
  const host = env.HOST === "0.0.0.0" ? "127.0.0.1" : env.HOST || "127.0.0.1"
  console.log(`http://${host}:${env.PORT || 3001}`)
')
JUDGE_URL=http://127.0.0.1:5050 node "$app/server/self-test.js"

id pioneer >/dev/null 2>&1 || useradd --system --home-dir /var/lib/pioneer --no-create-home --shell /usr/sbin/nologin pioneer

cat > /etc/systemd/system/pioneer-api.service <<'EOF'
[Unit]
Description=Pioneer judging API
After=network.target go-judge.service
Wants=go-judge.service

[Service]
User=pioneer
Group=pioneer
WorkingDirectory=/opt/pioneer/app/server
Environment=NODE_ENV=production HOST=127.0.0.1 DATA_DIR=/var/lib/pioneer
EnvironmentFile=/etc/pioneer/api.env
UnsetEnvironment=ALLOW_GUEST
ExecStart=/opt/pioneer/tools/node/bin/node /opt/pioneer/app/server/index.js
StateDirectory=pioneer
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pioneer-api
systemctl restart pioneer-api
systemctl is-active --quiet pioneer-api

curl --retry 10 --retry-connrefused --retry-delay 1 -fs "$api_url/api/session" >/dev/null || {
  systemctl status pioneer-api --no-pager >&2
  exit 1
}

echo '后端安装完成。配置：/etc/pioneer/api.env；日志：journalctl -u pioneer-api -u go-judge。'
