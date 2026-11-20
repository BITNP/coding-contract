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

当前 `bitnp-oj` 已经以 native systemd 部署 Node、go-judge 和全部语言工具链，不需要 Docker/Podman 镜像。升级时复用这些组件，只替换应用代码和静态产物；Docker 镜像并不可复用于这台机器现有的 native 评测沙箱。

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

工具链和依赖缓存已经安装完整时，可执行 `sudo sh server/install.sh --app-only`：跳过 APT 和语言工具链下载，只从本机 pnpm 缓存离线安装 API 依赖，仍验证认证配置并运行全部语言的样例自检。离线依赖不齐时会停止，不会切换代理或在线下载。

## 可回滚发布

在构建机执行以下命令，会先构建前端，再生成包含 `server/`、`shared/`、`dist/` 和服务器脚本的发布包：

```sh
sh deploy/build-release.sh
```

发布包和 SHA-256 文件位于 `release/`。传到 `bitnp-oj` 后解压，并运行：

```sh
sudo sh deploy/server/update.sh
```

升级脚本只复用现有 Node、pnpm store、go-judge 和语言工具链，不会执行 `server/provision.sh`，也不会改动 `/var/lib/pioneer` 中的正式数据库。它会依次完成：

1. 把旧应用、旧静态站、systemd/Nginx 配置和 SQLite 在线一致性备份保存到 `/var/backups/coding-contract/`。
2. 在独立发布目录安装生产依赖，核对评测工具链版本，运行 17 种语言自检，并用临时数据库启动新版 API。
3. 通过预检后切换 `/opt/pioneer/app` 和 `/var/www/coding-contract`，重启 `pioneer-api` 并重载 Nginx。
4. 本机健康检查失败时自动恢复升级前应用和静态站。

如切换后发现问题，可手动回滚：

```sh
sudo sh deploy/server/rollback.sh /var/backups/coding-contract/latest
```

回滚默认保留当前数据库，避免丢失升级后产生的新记录；备份中的 `contest.sqlite` 只用于需要整体灾难恢复且确认要丢弃新数据的情况。完整验收可运行：

```sh
sudo sh deploy/server/verify.sh
```

## 管理台与裁判权限

角色配置单独保存在 `/etc/pioneer/roles.env`，不会和 OIDC 客户端密钥放在同一个文件。首次升级时，脚本会把 `api.env` 中已有的 `ADMIN_USERS`、`REFEREE_USERS` 复制过去；已有角色文件不会被覆盖。

编辑配置：

```sh
sudoedit /etc/pioneer/roles.env
```

填写 Keycloak OIDC 的稳定 `sub`，多个账号用逗号分隔：

```dotenv
ADMIN_USERS=管理员的sub
REFEREE_USERS=裁判一的sub,裁判二的sub
```

账号登录后可访问 `/api/session`，响应中的 `user.id` 就是对应 `sub`。修改角色后重启后端使配置生效：

```sh
sudo systemctl restart pioneer-api
```

重启会使所有用户重新登录。只修改角色时不需要重载 Nginx、修改 Traefik，也不需要重启 `go-judge`。

## bitnp-oj 本次更新

本次从旧作战模型切换到三题任选，数据库改为 `contest.sqlite`。以下命令会按本次授权删除旧的内部测试数据；日常更新不要执行删除数据库的步骤。源码和构建产物已放在 OJ 的 `/home/bitnp/coding-contract`，在该机器终端执行：

```sh
cd /home/bitnp/coding-contract
sudo apt-get -o Acquire::http::Proxy=DIRECT -o Acquire::https::Proxy=DIRECT install -y libnginx-mod-http-brotli-static
sudo systemctl stop pioneer-api
sudo rm -f /var/lib/pioneer/pioneer.db /var/lib/pioneer/pioneer.db-wal /var/lib/pioneer/pioneer.db-shm /var/lib/pioneer/contest.sqlite /var/lib/pioneer/contest.sqlite-wal /var/lib/pioneer/contest.sqlite-shm
sudo sh server/install.sh --app-only
sudo rsync -a --delete dist/ /var/www/coding-contract/
sudo install -m 644 deploy/oj.nginx.conf /etc/nginx/sites-available/coding-contract
sudo /usr/sbin/nginx -t
sudo systemctl reload nginx
sudo systemctl is-active pioneer-api go-judge nginx
```

每条命令成功后再执行下一条；出现错误先停止并保留输出。不要用 `sudo -E` 或给整个安装脚本设置代理。APT 的 DIRECT 参数让软件源直连，应用更新使用离线缓存。`/etc/pioneer/api.env` 中旧的 `ADMIN_USERS` 可删除，其他认证配置和密钥保留。上线后重新登录，按 [管理权限验证步骤](keycloak.md#验证与权限变化) 检查普通用户和管理员。
