# 开发与实现

## 本地运行

前后端分别启动：

```sh
# 前端，端口 5173
pnpm install --frozen-lockfile
pnpm dev

# 后端，另一个终端，端口 3001
pnpm --dir server --ignore-workspace install --frozen-lockfile
ALLOW_GUEST=1 pnpm --dir server --ignore-workspace dev
```

配置模板：[前端](../.env.example)、[后端](../server/.env.example)，分别复制为同目录的 `.env`。`VITE_API_PROXY` 指向开发 API，`JUDGE_URL` 指向 Linux 上的 go-judge。本地使用 Lima 时，安装 Lima 后运行 `pnpm judge:install`；日常启停用 `pnpm judge:start` / `pnpm judge:stop`。需要示例数据时运行 `pnpm seed:demo`，向 `DATA_DIR`（默认 `server/data`）写入排行榜记录和进行中的作战，可重复运行。

## 代码入口

| 修改内容                     | 入口                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| 页面与样式                   | [src/views/](../src/views/)、[theme.js](../src/theme.js)、[style.css](../src/style.css)                  |
| 语言、指标与判定规则         | [shared/](../shared/)                                                                                    |
| API、会话与 SQLite           | [server/index.js](../server/index.js)；客户端调用见 [src/api.js](../src/api.js)                          |
| 题目、回合与测试数据         | [server/questions/](../server/questions/)、[operations.js](../server/operations.js)                      |
| 评测、源码分析、编译运行命令 | [judge.js](../server/judge.js)、[analyze.py](../server/analyze.py)、[runtimes.js](../server/runtimes.js) |
| Linux 安装与工具链           | [install.sh](../server/install.sh)、[provision.sh](../server/provision.sh)                               |

## 作战与题目

一次作战分三个回合：第 1 回合「最长升温」，第 2 回合从「补给窗口 / 迷宫寻路 / 信道排班」中任选一题，第 3 回合「物资周转」。题目和回合顺序在 [questions/index.js](../server/questions/index.js) 配置，回合状态由 [operations.js](../server/operations.js) 维护。

- 「环境：时限」和「环境：感官遮蔽」开局后整场锁定；其他指标在作战中随时可调整（点击顶栏「编辑指标」切换到调整页），改动立即保存，下一回合沿用，计时不暂停。
- 提交通过且达成全部指标才进入下一回合，未通过可继续提交。每回合都可放弃（本回合记 0 分）：前两回合放弃后进入下一回合，第三回合放弃即结束作战并结算。作战未结束时，选择指标页的大按钮变为「继续作战」。到时仍在作答时，前端自动提交一次。
- 总分为已通过回合的指标分之和，最高分与用时进入排行榜。未开放回合的题目不会发给前端。

部分题型参考洛谷 P1567、P1115 与 LeetCode 714，题面和评测数据独立编写。每题覆盖边界和最大规模，题面样例即第一组数据。`tests/rounds.test.js` 与 `tests/question.test.js` 用暴力解核对小数据，并验证常见错解被拒绝。运行时限为每组 2 秒，沙箱内存上限 256 MiB。

各语言初始模板只有基础骨架（`shared/languages.js`）；补给窗口另存 17 种语言的参考解（均不超过 1024 字节），用于评测、内存基准和安装自检。

## 监考与管理

作战期间要求全屏，并拦截 F5、F11、F12 及刷新、关闭或新建标签等快捷键，防止误触。[integrity.js](../src/integrity.js) 记录全屏切换、切屏、失焦、粘贴和开发者工具快捷键，每 5 秒检查一次，有新事件或代码变化时连同代码快照上报，否则每 30 秒发送心跳。这些记录只作辅助判断，无法在浏览器端真正阻止作弊。

管理台 `/admin` 显示最近 24 小时的作战、回合进度、异常事件和实时代码。统一登录时按 `ADMIN_USERS` 中的 OIDC `sub` 授权，本地访客模式直接开放管理台。排行榜 `/leaderboard` 公开显示前 50 名的各回合得分与总计。

## 评测机制

编辑时在浏览器本地检查源码；样例和提交由后端重新分析、编译并在 go-judge 沙箱运行，按服务端保存的指标计分。编译不计入运行时限和内存限制。

运行阶段统一使用题目的 256 MiB 沙箱硬上限，再把 go-judge 报告的峰值与所选内存预算比较，超过预算返回 MLE。三档预算依次为 16,000,000、4,000,000、325,325 字节（十进制 MB/kB）。指标不改变沙箱硬上限：否则较小限额会触发更积极的内核回收，出现低档通过而高档超限的反常判定。统计的是 cgroup 峰值，包含运行时开销。

C/C++ 使用 Clang、Python 使用 AST 检查语法指标；其他语言只开放通用指标。支持范围统一维护在 `shared/languages.js`。新增语言时同步更新基础模板、补给窗口参考解、运行命令和工具链，并运行全语言测试。

作战存放在 `DATA_DIR/operations.sqlite`，使用 SQLite WAL。认证配置见 [README](../README.md#网协统一认证)。

## 验证

```sh
pnpm --dir server --ignore-workspace install --frozen-lockfile
pnpm test                    # 本地规则、认证与作战 API
pnpm test:judge              # 真实沙箱与全部语言
pnpm bench:memory            # 固定运行条件，17 种参考解各测三轮并输出 JSON
DEPLOYMENT_URL=http://127.0.0.1:3001 pnpm test # 额外检查部署端点与跨域
pnpm build
```

`server/tests/auth.test.js` 使用本地模拟认证服务和真实 RSA 签名令牌，验证 PKCE、state/nonce、签名、issuer/audience、回调重放、过期、退出，以及实际 API 的登录限制；不需要真实账号或客户端密钥。真实沙箱测试仍需安装 go-judge 和全部语言工具链。

## 素材署名

- 布局参考：项目内 UI 参考图，TIFF 署名 Nether_Dream。
- 游戏素材：[终末地危机合约资源索引](https://endfield-assets.fffdan.com/vfs/Bundle/search/contingencycontract?suffix=.png)。
- 工业 SVG：[Yue-plus/endfield_icons](https://github.com/Yue-plus/endfield_icons)。
- 钥匙图标：[Google Material Symbols](https://github.com/google/material-design-icons)，[Apache 2.0 许可证](../src/assets/material-symbols/LICENSE)。
