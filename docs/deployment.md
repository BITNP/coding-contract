# 同域部署

`oj.bitnp.net` 由入口 Traefik 终止 HTTPS，再转发到 OJ 机器的 Nginx 80 端口。Nginx 托管静态前端，`/api/` 转发到回环地址的 API；go-judge 只监听回环地址 5050。后端保留全部 17 种语言。

## 认证与后端

先运行 `sudo install -d -m 755 /etc/pioneer`。在 Keycloak 注册独立客户端，可参考 [客户端模板](../deploy/keycloak-client.json)。按 [统一认证说明](../README.md#网协统一认证) 配置 `/etc/pioneer/api.env`，权限为 `600`，并在 `REFEREE_USERS` 中填写裁判的 OIDC `sub`（多个用逗号分隔）。服务默认监听 `127.0.0.1:3001`，数据目录为 `/var/lib/pioneer`。安装脚本在启动服务前检查 OIDC 配置，生产服务禁用访客模式。

上传 `server/` 和 `shared/` 到同一目录，执行：

```sh
sudo sh server/install.sh
```

安装脚本使用直连软件源。如仅 GitHub 发布包需要代理，单独设置 `GO_JUDGE_PROXY` 为 OJ 机器可访问的代理地址：

```sh
sudo env GO_JUDGE_PROXY=http://127.0.0.1:8080 sh server/install.sh
```

该变量只用于 go-judge 的 GitHub 下载，不影响 APT、Node、npm 或 Swift。代理监听地址需按实际环境替换。

## 前端与 Nginx

构建前端时省略 `VITE_API_BASE_URL`，使用同源 `/api`：

```sh
pnpm install --frozen-lockfile
pnpm build
```

上传完整的 `dist/` 和 `deploy/oj.nginx.conf`。在 Debian 13 的 OJ 机器上执行：

```sh
sudo apt-get install -y nginx libnginx-mod-http-brotli-static rsync
sudo install -d -m 755 /var/www/coding-contract
sudo rsync -a --delete dist/ /var/www/coding-contract/
sudo install -m 644 deploy/oj.nginx.conf /etc/nginx/sites-available/coding-contract
sudo ln -sfn /etc/nginx/sites-available/coding-contract /etc/nginx/sites-enabled/coding-contract
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

构建会为语言服务资源生成 `.br` 和 `.gz` 副本。Nginx 按浏览器支持的编码返回 Brotli、gzip 或原文件，保留原 URL 和 MIME 类型。

## 验证与更新

确认 `nginx`、`pioneer-api`、`go-judge` 都处于 active 状态。浏览器完成统一登录后，`/api/session` 应返回当前用户；未登录的作战和记录 API 应返回 401。退出只清除本应用会话。裁判台 `/referee` 对 `REFEREE_USERS` 中的账号开放，名单外账号应返回 403。

`server/install.sh` 会运行全部语言的样例自检。真实沙箱和部署端点的验证命令见[开发说明](development.md#验证)。

更新后端时重跑安装脚本，保留 `/etc/pioneer/api.env` 和 `/var/lib/pioneer/`。更新前端时重新构建并替换静态产物。浏览器分别缓存 C/C++、Python 和 JS/TS 的语言服务资源。
