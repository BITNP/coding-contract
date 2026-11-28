# Coding Contract: Net-Pioneer Experimental Operation

网协合约 · 开拓测试作战

## 后端

Debian 13（ARM64 / x86_64），建议 4 核、4 GiB 内存、20 GiB 可用磁盘。

上传 `server/` 和 `shared/` 到同一目录，按下节说明配置统一认证后执行：

```sh
sudo sh server/install.sh
```

API 默认监听 `127.0.0.1:3001`。将 API 域名反向代理到该端口并配置 HTTPS。

编辑 `/etc/pioneer/api.env`，将 `CORS_ORIGINS` 设为前端来源（如 `https://www.example.com`，多个用逗号分隔）。前端与 API 跨站点时，另设 `COOKIE_SAME_SITE=none`。

```sh
sudo systemctl restart pioneer-api
curl http://127.0.0.1:3001/api/session
```

## 网协统一认证

使用 Keycloak OIDC 授权码 + PKCE 登录，应用不接收统一账号密码。生产部署前在 Keycloak 的 `master` realm 注册独立客户端，可导入 [客户端配置](deploy/keycloak-client.json)。

首次安装前创建 `/etc/pioneer` 目录，将以下配置写入 `/etc/pioneer/api.env`，文件权限设为 `600`。

```dotenv
OIDC_ISSUER=https://login.bitnp.net/realms/master
OIDC_CLIENT_ID=coding-contract
OIDC_CLIENT_SECRET=填写此客户端的专用密钥
OIDC_REDIRECT_URL=https://oj.bitnp.net/api/auth/callback
APP_PUBLIC_URL=https://oj.bitnp.net
CORS_ORIGINS=https://oj.bitnp.net
COOKIE_SAME_SITE=lax
ADMIN_USERS=
REFEREE_USERS=
```

客户端启用 Standard Flow、关闭 Direct Access Grants，并要求 PKCE S256。密钥只保存在服务器环境文件中，已有客户端时先核对配置，避免覆盖。管理员和裁判名单填写 OIDC 的稳定 `sub`，多个 ID 以逗号分隔，可从已登录用户的 `/api/session` 响应读取 `user.id`。裁判端地址为 `/referee`，名单外账号无法进入。

前端 `/api/` 必须反代到 API（包括 `/api/auth/login` 和 `/api/auth/callback`），回调地址须精确匹配。认证地址和站点地址使用 HTTPS；生产 Cookie 固定启用 Secure，不依赖代理头推断。

登录后以 Keycloak 的 `sub` 保存用户记录，作战和最高分 API 都要求登录。会话保存在内存中，最长 24 小时，API 重启后需重新登录，退出仅注销本应用会话。生产服务要求完整的 OIDC 配置。本地开发可显式设置 `ALLOW_GUEST=1` 并留空四项 OIDC 参数，以共享访客身份体验作战、裁判台和管理台。

## 裁判核验

「古法编程」等 `verification: manual` 的条款无法由评测机判断，需要现场裁判核验；依赖它们的条款（需先选入「古法编程 III」才开放的锁闭指标）同样无法自动核验。

- 选入这类条款后点击「行动开始」会提示寻找现场裁判。参赛者可在作战页查看 4 位配对码，裁判在 `/referee` 输入或按姓名接入，一名裁判可同时监督多名参赛者。
- 裁判端支持多名裁判：每个人都能看到全局需要核验的作战，但默认只筛选出自己接入的选手，可切到「全部裁判」查看其他人监督的作战（只能查看，核验仍由接入的裁判完成）。
- 未配对直接开始：通过后只结算可自动核验部分的得分（排行榜按此有效成绩排名），结算页同时显示「有效成绩」与「所选成绩」并提示差额来自未核验条款；依赖未核验条款的得分同样不计入。
- 配对后开始：通过时先记 0 分并进入待核验状态，裁判确认后按所选成绩计入，驳回则记 0 分；作战结束后不能再补配对，避免事后补核验。
- 不含线下核验条款的作战完全由后端判定，不经过裁判。裁判端权限由 `REFEREE_USERS` 控制，访客模式下直接开放。

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
