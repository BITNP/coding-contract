#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

for command in git pnpm rsync tar; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "缺少命令：$command" >&2
    exit 1
  }
done

commit=$(git rev-parse --short=12 HEAD)
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
release_id=${RELEASE_ID:-"$commit-$timestamp"}

case "$release_id" in
  *[!A-Za-z0-9._-]*)
    echo "RELEASE_ID 只能包含字母、数字、点、下划线和连字符。" >&2
    exit 1
    ;;
esac

registry=${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org}
echo "安装锁定依赖（${registry}）"
CI=true NPM_CONFIG_REGISTRY="$registry" pnpm install --frozen-lockfile --registry="$registry"
pnpm build

stage=$(mktemp -d "${TMPDIR:-/tmp}/coding-contract-release.XXXXXX")
trap 'rm -rf "$stage"' 0 1 2 15
bundle="$stage/coding-contract-$release_id"
mkdir -p "$bundle"/server "$bundle"/shared "$bundle"/dist "$bundle"/deploy/server

rsync -a \
  --exclude node_modules \
  --exclude data \
  --exclude .env \
  --exclude .DS_Store \
  --exclude '._*' \
  server/ "$bundle/server/"
rsync -a --exclude .DS_Store --exclude '._*' shared/ "$bundle/shared/"
rsync -a --exclude .DS_Store --exclude '._*' dist/ "$bundle/dist/"
cp deploy/oj.nginx.conf "$bundle/deploy/oj.nginx.conf"
cp \
  deploy/server/update.sh \
  deploy/server/rollback.sh \
  deploy/server/verify.sh \
  deploy/server/roles.conf \
  deploy/server/roles.env.example \
  "$bundle/deploy/server/"
cp docs/deployment.md "$bundle/deployment.md"

{
  printf 'RELEASE_ID=%s\n' "$release_id"
  printf 'GIT_COMMIT=%s\n' "$commit"
  printf 'BUILT_AT=%s\n' "$timestamp"
} > "$bundle/release.env"

mkdir -p release
archive="$root/release/coding-contract-$release_id.tar.gz"
find "$stage" -exec touch -t 200001010000.00 {} +
COPYFILE_DISABLE=1 tar --no-xattrs -C "$stage" -czf "$archive" "coding-contract-$release_id"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$root/release" && sha256sum "$(basename "$archive")" > "$(basename "$archive").sha256")
else
  (cd "$root/release" && shasum -a 256 "$(basename "$archive")" > "$(basename "$archive").sha256")
fi

printf '\n发布包：%s\n校验文件：%s\n' "$archive" "$archive.sha256"
