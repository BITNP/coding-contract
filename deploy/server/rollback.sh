#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo '请以 root 身份运行：sudo sh deploy/server/rollback.sh <备份目录>' >&2
  exit 1
fi

backup=${1:-/var/backups/coding-contract/latest}
app=/opt/pioneer/app
web=/var/www/coding-contract
failed_root=/opt/pioneer/releases
failed_web_root=/var/www/releases
timestamp=$(date -u +%Y%m%dT%H%M%SZ)

for path in "$backup/app" "$backup/web" "$backup/config/api.env"; do
  [ -e "$path" ] || {
    echo "备份不完整，缺少 $path" >&2
    exit 1
  }
done

staged_app="$failed_root/.rollback-$timestamp"
staged_web="$failed_web_root/.rollback-$timestamp"
install -d -m 755 "$failed_root" "$failed_web_root"
rm -rf "$staged_app" "$staged_web"
cp -a "$backup/app" "$staged_app"
cp -a "$backup/web" "$staged_web"

mv "$app" "$failed_root/failed-$timestamp"
mv "$staged_app" "$app"
mv "$web" "$failed_web_root/failed-$timestamp"
mv "$staged_web" "$web"

cp -a "$backup/config/api.env" /etc/pioneer/api.env
chmod 600 /etc/pioneer/api.env
cp -a "$backup/config/pioneer-api.service" /etc/systemd/system/pioneer-api.service
cp -a "$backup/config/go-judge.service" /etc/systemd/system/go-judge.service
cp -a "$backup/config/nginx.conf" /etc/nginx/sites-available/coding-contract

systemctl daemon-reload
nginx -t
systemctl restart pioneer-api
systemctl is-active --quiet pioneer-api
curl --retry 20 --retry-connrefused --retry-delay 1 -fsS \
  http://127.0.0.1:3001/api/session >/dev/null
systemctl reload nginx

echo "已回滚到升级前版本：$backup"
echo '数据库保持为回滚前的当前数据；如需灾难恢复，请单独评估并恢复备份中的 contest.sqlite。'
