#!/bin/sh
set -eu

export PATH=/opt/pioneer/tools/node/bin:/opt/pioneer/tools/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
tools=/opt/pioneer/tools
node="$tools/node/bin/node"
pnpm="$tools/pnpm/bin/pnpm"
app=/opt/pioneer/app
web=/var/www/coding-contract
releases=/opt/pioneer/releases
web_releases=/var/www/releases
backup_root=/var/backups/coding-contract
roles_env=/etc/pioneer/roles.env
roles_dropin=/etc/systemd/system/pioneer-api.service.d/roles.conf
preflight_pid=
preflight_data=
rollback_on_failure=0
backup=

if [ "$(id -u)" -ne 0 ]; then
  echo '请以 root 身份运行：sudo sh deploy/server/update.sh' >&2
  exit 1
fi

for file in release.env server/index.js server/self-test.js shared/package.json dist/index.html; do
  [ -f "$root/$file" ] || {
    echo "发布包不完整，缺少 $file" >&2
    exit 1
  }
done

. "$root/release.env"
case "${RELEASE_ID:-}" in
  ''|*[!A-Za-z0-9._-]*)
    echo 'release.env 中的 RELEASE_ID 无效。' >&2
    exit 1
    ;;
esac

for command in cmp cp curl install mv nginx pnpm rsync sha256sum systemctl tar; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "服务器缺少命令：$command" >&2
    exit 1
  }
done

for file in "$node" "$pnpm" /etc/pioneer/api.env /opt/pioneer/tools/pnpm-store; do
  [ -e "$file" ] || {
    echo "现有部署缺少 ${file}；请先按旧版安装流程准备基础环境。" >&2
    exit 1
  }
done

for unit in pioneer-api go-judge; do
  systemctl is-active --quiet "$unit" || {
    echo "$unit 当前未运行；拒绝在异常状态下升级。" >&2
    exit 1
  }
done

expected_provision=$(sha256sum "$root/server/provision.sh" | awk '{print $1}')
installed_provision=$(sha256sum /opt/pioneer/app/server/provision.sh | awk '{print $1}')
if [ "$expected_provision" != "$installed_provision" ]; then
  echo '评测工具链配置与服务器现有版本不一致。' >&2
  echo '本次升级只替换应用代码；请先为新版评测工具链安排维护窗口，再更新基础环境。' >&2
  exit 1
fi

cleanup() {
  if [ -n "$preflight_pid" ]; then
    kill "$preflight_pid" 2>/dev/null || true
    wait "$preflight_pid" 2>/dev/null || true
    preflight_pid=
  fi
  if [ -n "$preflight_data" ]; then
    rm -rf "$preflight_data"
    preflight_data=
  fi
}

finish() {
  status=$?
  cleanup
  if [ "$status" -ne 0 ] && [ "$rollback_on_failure" -eq 1 ]; then
    trap - 0
    echo '新版本健康检查失败，开始自动回滚。' >&2
    sh "$root/deploy/server/rollback.sh" "$backup" || true
  fi
  exit "$status"
}
trap finish 0
trap 'exit 130' 1 2 15

backup="$backup_root/$RELEASE_ID-$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 700 "$backup_root" "$backup"
cp -a "$app" "$backup/app"
cp -a "$web" "$backup/web"
install -d -m 700 "$backup/config"
cp -a /etc/pioneer/api.env "$backup/config/api.env"
cp -a /etc/systemd/system/pioneer-api.service "$backup/config/pioneer-api.service"
cp -a /etc/systemd/system/go-judge.service "$backup/config/go-judge.service"
cp -a /etc/nginx/sites-available/coding-contract "$backup/config/nginx.conf"
if [ -e "$roles_env" ]; then
  cp -a "$roles_env" "$backup/config/roles.env"
fi
if [ -e "$roles_dropin" ]; then
  cp -a "$roles_dropin" "$backup/config/roles.conf"
fi
printf 'RELEASE_ID=%s\nGIT_COMMIT=%s\n' "$RELEASE_ID" "${GIT_COMMIT:-unknown}" > "$backup/release.env"

"$node" --input-type=module -e '
  import { backup, DatabaseSync } from "node:sqlite"
  const [source, target] = process.argv.slice(1)
  const db = new DatabaseSync(source, { readOnly: true })
  try {
    await backup(db, target)
  } finally {
    db.close()
  }
' /var/lib/pioneer/contest.sqlite "$backup/contest.sqlite"
chmod 600 "$backup/config/api.env" "$backup/contest.sqlite"

new_app="$releases/$RELEASE_ID"
new_web="$web_releases/$RELEASE_ID"
install -d -m 755 "$releases" "$web_releases"
rm -rf "$new_app" "$new_web"
install -d -m 755 "$new_app" "$new_web"
rsync -a \
  --exclude node_modules \
  --exclude data \
  --exclude .env \
  "$root/server/" "$new_app/server/"
rsync -a "$root/shared/" "$new_app/shared/"
rsync -a "$root/dist/" "$new_web/"
chmod -R a+rX "$new_app" "$new_web"

if cmp -s "$app/server/package.json" "$new_app/server/package.json" &&
  cmp -s "$app/server/pnpm-lock.yaml" "$new_app/server/pnpm-lock.yaml" &&
  [ -d "$app/server/node_modules" ]; then
  echo '后端依赖未变化，直接复用现有 node_modules'
  cp -a "$app/server/node_modules" "$new_app/server/node_modules"
else
  echo '后端依赖有变化，从现有 pnpm store 离线安装'
  CI=true "$pnpm" --dir "$new_app/server" --ignore-workspace install \
    --prod --frozen-lockfile --offline --store-dir "$tools/pnpm-store"
fi
chmod -R a+rX "$new_app/server/node_modules"

echo '检查生产认证配置'
"$node" --input-type=module -e '
  import { readFileSync } from "node:fs"
  import { pathToFileURL } from "node:url"
  import { parseEnv } from "node:util"
  const { authConfig } = await import(pathToFileURL(process.argv[1]).href)
  const env = parseEnv(readFileSync("/etc/pioneer/api.env", "utf8"))
  authConfig({ ...env, NODE_ENV: "production" })
' -- "$new_app/server/auth.js"

echo '在现有 go-judge 上运行 17 种语言自检'
JUDGE_URL=http://127.0.0.1:5050 "$node" "$new_app/server/self-test.js"

echo '使用临时数据库启动新版 API 并检查会话端点'
preflight_data=$(mktemp -d /var/tmp/pioneer-preflight.XXXXXX)
"$node" --input-type=module -e '
  process.loadEnvFile("/etc/pioneer/api.env")
  process.env.NODE_ENV = "production"
  process.env.HOST = "127.0.0.1"
  process.env.PORT = "39001"
  process.env.DATA_DIR = process.argv[2]
  process.env.JUDGE_URL = "http://127.0.0.1:5050"
  delete process.env.ALLOW_GUEST
  await import(process.argv[1])
' "$new_app/server/index.js" "$preflight_data" > "$backup/preflight.log" 2>&1 &
preflight_pid=$!

preflight_ok=0
i=0
while [ "$i" -lt 50 ]; do
  if curl -fsS http://127.0.0.1:39001/api/session >/dev/null 2>&1; then
    preflight_ok=1
    break
  fi
  kill -0 "$preflight_pid" 2>/dev/null || break
  i=$((i + 1))
  sleep 0.2
done
cleanup
if [ "$preflight_ok" -ne 1 ]; then
  echo '新版 API 预检失败，日志如下：' >&2
  sed -n '1,160p' "$backup/preflight.log" >&2
  exit 1
fi

if [ -e "$roles_env" ]; then
  rm -f "$roles_env"
  echo '已移除旧角色名单：/etc/pioneer/roles.env，权限改由 Keycloak 的 admin 角色授予'
fi
if [ -e "$roles_dropin" ]; then
  rm -f "$roles_dropin"
  echo '已移除 systemd 覆盖：pioneer-api.service.d/roles.conf'
fi

legacy_app="$releases/previous-$RELEASE_ID"
legacy_web="$web_releases/previous-$RELEASE_ID"
[ ! -e "$legacy_app" ] && [ ! -e "$legacy_web" ] || {
  echo '发现同名旧版本目录，拒绝覆盖。' >&2
  exit 1
}

rollback_on_failure=1
mv "$app" "$legacy_app"
ln -s "$new_app" "$app"
mv "$web" "$legacy_web"
ln -s "$new_web" "$web"

systemctl daemon-reload
nginx -t
systemctl restart pioneer-api
systemctl is-active --quiet pioneer-api
curl --retry 20 --retry-connrefused --retry-delay 1 -fsS \
  http://127.0.0.1:3001/api/session >/dev/null
systemctl reload nginx
curl --retry 10 --retry-connrefused --retry-delay 1 -fsS \
  -H 'Host: oj.bitnp.net' http://127.0.0.1/ >/dev/null

printf '%s\n' "$RELEASE_ID" > /etc/pioneer/release
ln -sfn "$backup" "$backup_root/latest"
rollback_on_failure=0

echo "部署完成：$RELEASE_ID"
echo "本次备份：$backup"
echo "数据保留：/var/lib/pioneer"
echo "管理权限：Keycloak coding-contract 客户端的 admin 角色"
