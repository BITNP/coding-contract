# 同域部署

`oj.bitnp.net` 由入口 Traefik 终止 HTTPS，再转发到 OJ 机器的 Nginx 80 端口。Nginx 托管静态前端，`/api/` 转发到回环地址的 API；go-judge 只监听回环地址 5050。后端保留全部 17 种语言。

## 认证与后端

先运行 `sudo install -d -m 755 /etc/pioneer`。在 Keycloak 注册独立客户端，可参考 [客户端模板](../deploy/keycloak-client.json)。按 [统一认证说明](../README.md#网协统一认证) 配置 `/etc/pioneer/api.env`，权限为 `600`，并设置 `HOST=127.0.0.1` 和 `DATA_DIR=/var/lib/pioneer`。在第一次启动生产 API 前完成配置，不使用开发访客模式。

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

上传 `dist/` 和 `deploy/oj.nginx.conf`。在 OJ 机器上安装 Nginx 和 rsync，然后执行：

```sh
sudo install -d -m 755 /var/www/coding-contract
sudo rsync -a --delete dist/ /var/www/coding-contract/
sudo install -m 644 deploy/oj.nginx.conf /etc/nginx/sites-available/coding-contract
sudo ln -sfn /etc/nginx/sites-available/coding-contract /etc/nginx/sites-enabled/coding-contract
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

保留 `.mjs` 的 JavaScript MIME 类型规则，C/C++ 语言服务需要动态导入 `clangd-runtime.mjs`。配置同时提供 gzip、协商缓存和 SPA 路由回退；缺失的脚本或 WASM 资源返回 404，不回退到 HTML。固定文件名的资源不使用长期 immutable 缓存。

## 验证与更新

确认 `nginx`、`pioneer-api`、`go-judge` 都处于 active 状态。浏览器完成统一登录后，`/api/session` 应返回当前用户；未登录的作战和记录 API 应返回 401。退出只清除本应用会话。

`server/install.sh` 会运行全部语言的样例自检。评测边界与异常判定可使用 `JUDGE_INTEGRATION=1 node --test tests/judge.test.js` 验证。原 `tests/deployment.test.js` 针对本地访客模式，不应直接用于开启 OIDC 的生产实例。

更新后端时重跑安装脚本，保留 `/etc/pioneer/api.env` 和 `/var/lib/pioneer/`；更新前端时重新构建并替换静态产物。浏览器语言服务的缓存策略或响应元数据变化时，同时更新 `vite.config.js` 中的缓存版本。
