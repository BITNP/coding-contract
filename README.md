# 网协合约 · 开拓测试作战

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

## 前端

构建机安装 Node ≥ 22.13、pnpm 10.34.9，在项目根目录运行：

```sh
pnpm install --frozen-lockfile
VITE_API_BASE_URL=https://api.example.com/api pnpm build
```

把 `dist/` 上传到静态服务器，配置路由回退到 `index.html`。API 地址需替换为实际地址；如用同源反代 `/api`，构建时省略 `VITE_API_BASE_URL`。

## 更新与排错

更新后端：上传新代码，重跑安装命令；配置和 `/var/lib/pioneer/` 中的数据保留。更新前端：重新构建并替换 `dist/`。

```sh
sudo systemctl status pioneer-api go-judge
sudo journalctl -u pioneer-api -u go-judge -f
```

[开发与实现](docs/development.md)
