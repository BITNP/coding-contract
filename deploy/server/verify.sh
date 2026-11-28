#!/bin/sh
set -eu

echo '服务状态：'
for unit in nginx pioneer-api go-judge; do
  printf '  %-14s %s\n' "$unit" "$(systemctl is-active "$unit" 2>/dev/null || true)"
done

echo '本机 API 会话：'
curl -fsS --max-time 5 http://127.0.0.1:3001/api/session
printf '\n'

echo '未登录访问作战 API（预期 401）：'
status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3001/api/operations)
printf '  HTTP %s\n' "$status"
[ "$status" = 401 ] || {
  echo '未获得预期的 401，请检查生产认证配置。' >&2
  exit 1
}

echo 'Nginx 同域入口：'
curl -fsSI --max-time 5 -H 'Host: oj.bitnp.net' http://127.0.0.1/ | sed -n '1,8p'

echo '评测环境：'
JUDGE_URL=http://127.0.0.1:5050 \
  /opt/pioneer/tools/node/bin/node /opt/pioneer/app/server/self-test.js
