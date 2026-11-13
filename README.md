# Coding Contract: Net-Pioneer Experimental Operation

网协合约 · 开拓测试作战

## 后端

Debian 13（ARM64 / x86_64），建议 4 核、4 GiB 内存、20 GiB 可用磁盘。

上传 `server/` 和 `shared/` 到同一目录，执行：

```sh
sudo sh server/install.sh
```

API 默认端口为 `3001`。将 API 域名反向代理到该端口并配置 HTTPS。

编辑 `/etc/pioneer/api.env`，将 `CORS_ORIGINS` 设为前端来源（如 `https://www.example.com`，多个用逗号分隔）。前端与 API 跨站点时，另设 `COOKIE_SAME_SITE=none`。

```sh
sudo systemctl restart pioneer-api
curl http://127.0.0.1:3001/api/session
```

## 网协统一认证

使用 Keycloak OIDC 授权码 + PKCE 登录，应用不接收统一账号密码。生产部署前在 Keycloak 的 `master` realm 注册独立客户端，可导入 [客户端配置](deploy/keycloak-client.json)。

在 `/etc/pioneer/api.env` 中完整配置：

```dotenv
OIDC_ISSUER=https://login.bitnp.net/realms/master
OIDC_CLIENT_ID=coding-contract
OIDC_CLIENT_SECRET=填写此客户端的专用密钥
OIDC_REDIRECT_URL=https://oj.bitnp.net/api/auth/callback
APP_PUBLIC_URL=https://oj.bitnp.net
CORS_ORIGINS=https://oj.bitnp.net
COOKIE_SAME_SITE=lax
```

客户端启用 Standard Flow、关闭 Direct Access Grants，并要求 PKCE S256。密钥只保存在服务器环境文件中，文件权限设为 `600`，不要提交到仓库或发送到聊天。已有客户端时先核对配置，避免覆盖。

前端 `/api/` 必须反代到 API（包括 `/api/auth/login` 和 `/api/auth/callback`），回调地址须精确匹配。认证地址和站点地址使用 HTTPS；生产 Cookie 固定启用 Secure，不依赖代理头推断。

登录后以 Keycloak 的稳定 `sub` 保存用户记录，未登录不能访问作战或最高分 API。会话保存在内存中、最长 24 小时，API 重启后需重新登录；退出仅注销本应用会话。未配置任何 OIDC 参数时保留本地访客模式，访客共用记录；生产环境应在启动 API 前配置完整认证参数。旧 `AUTH_API_URL` 已停用，缺少部分 OIDC 参数会阻止启动。

## 前端

构建机安装 Node ≥ 22.13、pnpm 10.34.9，在项目根目录运行：

```sh
pnpm install --frozen-lockfile
VITE_API_BASE_URL=https://api.example.com/api pnpm build
```

把 `dist/` 上传到静态服务器，配置路由回退到 `index.html`。API 地址需替换为实际地址；如用同源反代 `/api`，构建时省略 `VITE_API_BASE_URL`。

同域 Nginx 配置及部署步骤见 [部署说明](docs/deployment.md)。

静态服务器启用 JS、CSS、SVG 的 Brotli 或 gzip 压缩，并正确返回 WebP 与 WOFF2 的 MIME 类型。当前产物使用固定文件名，使用 ETag 或 Last-Modified 协商缓存，避免设置长期 `immutable` 缓存导致更新后仍加载旧文件。

## 更新与排错

更新后端：上传新代码，重跑安装命令；配置和 `/var/lib/pioneer/` 中的数据保留。更新前端：重新构建并替换 `dist/`。

```sh
sudo systemctl status pioneer-api go-judge
sudo journalctl -u pioneer-api -u go-judge -f
```

[开发与实现](docs/development.md)
