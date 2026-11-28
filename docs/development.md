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

配置模板：[前端](../.env.example)、[后端](../server/.env.example)，分别复制为同目录的 `.env`。`VITE_API_PROXY` 指向开发 API，`JUDGE_URL` 指向 Linux 上的 go-judge。本地使用 Lima 时，安装 Lima 后运行 `pnpm judge:install`；日常启停用 `pnpm judge:start` / `pnpm judge:stop`。没有 Linux 沙箱时（如 Windows 本地），可运行 `pnpm judge:mock` 启动假评测服务：它不执行代码，按题面样例直接返回期望输出，源码包含 `MOCK_WA` / `MOCK_CE` / `MOCK_TLE` 时分别模拟答案错误、编译错误与超时，仅用于前端与流程联调。需要示例数据时运行 `pnpm seed:demo`，向 `DATA_DIR`（默认 `server/data`）写入排行榜记录和进行中的作战，可重复运行。

## 代码入口

| 修改内容                     | 入口                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| 页面与样式                   | [src/views/](../src/views/)、[theme.js](../src/theme.js)、[style.css](../src/style.css)                  |
| 语言、指标与判定规则         | [shared/](../shared/)                                                                                    |
| API、会话与 SQLite           | [server/index.js](../server/index.js)；客户端调用见 [src/api.js](../src/api.js)                          |
| 裁判配对、核验与权限         | [referee.js](../server/referee.js)、[RefereeView.vue](../src/views/RefereeView.vue)                      |
| 有效成绩与自动可核验分数     | [contracts.js](../shared/contracts.js)、[operations.js](../server/operations.js)                         |
| 题库与作战状态         | [server/questions/](../server/questions/)、[operations.js](../server/operations.js)                      |
| 评测、源码分析、编译运行命令 | [judge.js](../server/judge.js)、[analyze.py](../server/analyze.py)、[runtimes.js](../server/runtimes.js) |
| Linux 安装与工具链           | [install.sh](../server/install.sh)、[provision.sh](../server/provision.sh)                               |

## 作战与题目

每场作战从「最长升温」「信道排班」「迷宫寻路」中任选一题。切题共用同一倒计时，草稿按题目和编程语言保存在本地。到时自动提交当前题目的代码。

通过全部测试点并满足所选指标即结算，得分为该次提交的指标分。未通过可继续尝试或换题，放弃或超时未通过记零分。「环境：时限」和「环境：感官遮蔽」开局后锁定，其余指标可随时调整。

每题的第一组数据对应题面样例，每组限时 2 秒、内存 256 MiB。「最长升温」的 17 种语言参考解用于安装自检和内存基准。

## 裁判核验

`verification: manual` 的条款（古法编程）及依赖它们的条款无法由评测机判断。选入这类条款并开始时，前端会提示寻找现场裁判；作战页显示 4 位配对码，裁判在 `/referee` 接入后即可开始监督。

- 未配对：通过后按 `automaticPoints(contracts)` 结算有效成绩，`selectedScore` 保留所选总分，结算页同时展示两者。
- 已配对：通过时 `review.status` 为 `pending`，`score` 保持 0 且不上榜；裁判在裁判端确认后按所选总分写入，驳回则保持 0 分。
- 作战结束后禁止补配对（`POST /api/referee/operations/:id/pair` 返回 409），核验在 `review` 中记录裁判与时间。
- 裁判名单由 `REFEREE_USERS` 控制，按 OIDC `sub` 匹配；访客模式（`auth.available === false`）直接开放，与管理台一致。名单可包含多名裁判：服务端对每个请求返回 `mine`（`operation.referee.id === 当前 sub`），列表接口始终返回全局在监作战，前端默认只看 `mine`，可切换为全部；核验接口仍只接受接入该选手的裁判。

## 监考与管理

作战期间要求全屏，并拦截 F5、F11、F12 及刷新、关闭或新建标签等快捷键，防止误触。[integrity.js](../src/integrity.js) 记录全屏切换、切屏、失焦、粘贴和开发者工具快捷键，每 5 秒检查一次，有新事件或代码变化时连同代码快照上报，否则每 30 秒发送心跳。这些记录只作辅助判断，无法在浏览器端真正阻止作弊。

管理台 `/admin` 显示最近 24 小时的作战、所选题目、异常事件和实时代码。统一登录时按 `ADMIN_USERS` 中的 OIDC `sub` 授权，本地访客模式直接开放管理台。裁判台 `/referee` 显示需要线下核验的作战：待配对、监督中、待确认与已结束四栏，可按异常行为和提交代码核对后确认或驳回成绩。排行榜 `/leaderboard` 公开显示前 50 名的通过题目、有效得分与用时。

## 评测机制

编辑时在浏览器本地检查源码；样例和提交由后端重新分析、编译并在 go-judge 沙箱运行，按服务端保存的指标计分。编译不计入运行时限和内存限制。

运行阶段统一使用题目的 256 MiB 沙箱硬上限，再把 go-judge 报告的峰值与所选内存预算比较，超过预算返回 MLE。三档预算依次为 16,000,000、4,000,000、325,325 字节（十进制 MB/kB）。指标不改变沙箱硬上限：否则较小限额会触发更积极的内核回收，出现低档通过而高档超限的反常判定。统计的是 cgroup 峰值，包含运行时开销。

C/C++ 使用 Clang、Python 使用 AST 检查语法指标；其他语言只开放通用指标。支持范围统一维护在 `shared/languages.js`。新增语言时同步更新基础模板、最长升温参考解、运行命令和工具链，并运行全语言测试。

作战存放在 `DATA_DIR/contest.sqlite`，使用 SQLite WAL。认证配置见 [README](../README.md#网协统一认证)。

## 验证

```sh
pnpm --dir server --ignore-workspace install --frozen-lockfile
pnpm test                    # 本地规则、认证、作战与裁判核验 API
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
