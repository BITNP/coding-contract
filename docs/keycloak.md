# Keycloak 管理权限

OJ 使用 `master` realm 的 `coding-contract` confidential client。应用只从经过签名、issuer、audience 和有效期校验的 ID Token 中读取 `resource_access.coding-contract.roles`，包含 `admin` 才能访问管理和裁判 API。`sub` 用于关联作战记录，不参与管理员授权。

## 首次配置

1. 导入 [客户端模板](../deploy/keycloak-client.json)，确认回调为 `https://oj.bitnp.net/api/auth/callback`，Standard Flow 开启，Direct Access Grants 关闭，PKCE 为 S256。将专用客户端密钥写入服务器 `/etc/pioneer/api.env`，权限为 `600`。
2. 在 Clients → coding-contract → Roles 新建 `admin`。客户端模板不包含角色定义，需要单独创建。
3. 在 Realm roles 分别打开 `permission-techsvc-admin` 和 `permission-techdept-admin`，在 Associated roles 中添加 coding-contract 的 `admin`。方向是两个部门角色包含 OJ 角色；保留原有组合角色。实际部门角色名为 `techdept`，不是 `techdpt`。
4. 在 coding-contract → Client scopes → coding-contract-dedicated → Scope 关闭 Full Scope Allowed，并在 Assign role 中选择 coding-contract 的 `admin`。Role scope 只限制可签发的角色，不会向普通用户授予权限。
5. 在该客户端专用的 Mappers 中确认 `coding-contract-client-roles`：类型为 User Client Role，Client ID 为 coding-contract，Token Claim Name 为 `resource_access.coding-contract.roles`，Claim JSON Type 为 String，Multivalued、Add to ID token、Add to access token 开启。模板已包含此 mapper；已有客户端手动补齐，不要覆盖客户端密钥或其他配置。

不要把 `admin` 加入 realm 默认角色。部门管理员通过现有 realm role 的组合关系自动获得权限，不需要在应用配置名单，也不需要逐个向用户分配 OJ 角色。

## 验证与权限变化

使用 Keycloak 的客户端 Scope evaluation 为部门管理员和普通用户分别生成示例 ID Token。前者应含 `resource_access.coding-contract.roles: ["admin"]`，后者不含该角色。仅有 realm 的 `admin` 或其他客户端的同名角色不授予 OJ 管理权限。

上线后重新登录，检查 `/api/session` 的 `user.isAdmin`，并验证 `/api/admin/operations`：管理员返回 200，普通用户返回 403，未登录返回 401。不要把完整令牌或密钥粘贴到日志、聊天或仓库。

活跃会话最多每 5 分钟通过 refresh token 获取新的 ID Token，重新计算权限；角色变化在下一次刷新后生效。并发请求共用一次刷新。刷新失败、缺少新的 ID Token、身份变化或签名无效会撤销本应用会话。会话最长 24 小时，refresh token 仅保存在服务器内存中；Keycloak 自身的 SSO / refresh token 有效期也可能要求更早重新登录。

已有部署应删除环境文件中旧的 `ADMIN_USERS` 和 `REFEREE_USERS`，以及 `/etc/pioneer/roles.env` 和 systemd 的 `roles.conf` 覆盖文件；升级脚本会自动删除后两者，新代码不再读取这些配置。认证参数和已有客户端密钥保持不变。
