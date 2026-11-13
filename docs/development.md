# 开发与实现

## 本地运行

前后端分别启动：

```sh
# 前端，端口 5173
pnpm install --frozen-lockfile
pnpm dev

# 后端，另一个终端，端口 3001
pnpm --dir server --ignore-workspace install --frozen-lockfile
pnpm --dir server --ignore-workspace dev
```

配置模板：[前端](../.env.example)、[后端](../server/.env.example)，分别复制为同目录的 `.env`。`VITE_API_PROXY` 指向开发 API，`JUDGE_URL` 指向 Linux 上的 go-judge。本地使用 Lima 时，安装 Lima 后运行 `pnpm judge:install`；日常启停用 `pnpm judge:start` / `pnpm judge:stop`。

## 代码入口

| 修改内容                     | 入口                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| 页面与样式                   | [src/views/](../src/views/)、[theme.js](../src/theme.js)、[style.css](../src/style.css)                  |
| 语言、指标与判定规则         | [shared/](../shared/)                                                                                    |
| API、会话与 SQLite           | [server/index.js](../server/index.js)；客户端调用见 [src/api.js](../src/api.js)                          |
| 题目、模板与测试数据         | [server/question.js](../server/question.js)                                                              |
| 评测、源码分析、编译运行命令 | [judge.js](../server/judge.js)、[analyze.py](../server/analyze.py)、[runtimes.js](../server/runtimes.js) |
| Linux 安装与工具链           | [install.sh](../server/install.sh)、[provision.sh](../server/provision.sh)                               |

## 评测机制

编辑时在浏览器本地检查源码；样例和提交由后端重新分析、编译并在 go-judge 沙箱运行，按服务端保存的指标计分。编译不计入运行时限和内存限制。

C/C++ 使用 Clang、Python 使用 AST 检查语法指标；其他语言只开放通用指标。支持范围统一维护在 `shared/languages.js`。新增语言时同步更新代码模板、运行命令和工具链，并运行全语言测试。

后端只提供 API。提交记录和最高分写入 SQLite，会话保存在内存中，重启后需重新登录。统一认证使用 OIDC 授权码 + PKCE，配置见 [README](../README.md#网协统一认证)。本地未配置任何 OIDC 参数时保留访客模式，访客共用记录；生产配置完整 OIDC 参数后，记录和作战 API 都要求登录。

## 验证

```sh
pnpm --dir server --ignore-workspace install --frozen-lockfile
pnpm test                    # 本地规则
pnpm test:judge              # 真实沙箱与全部语言
DEPLOYMENT_URL=http://127.0.0.1:3001 pnpm test # API、跨域、提交与记录
pnpm build
```

`server/tests/auth.test.js` 使用本地模拟认证服务和真实 RSA 签名令牌，验证 PKCE、state/nonce、签名、issuer/audience、回调重放、过期、退出，以及实际 API 的登录限制；不需要真实账号或客户端密钥。真实沙箱测试仍需安装 go-judge 和全部语言工具链。

## 素材署名

- 布局参考：项目内 UI 参考图，TIFF 署名 Nether_Dream。
- 游戏素材：[终末地危机合约资源索引](https://endfield-assets.fffdan.com/vfs/Bundle/search/contingencycontract?suffix=.png)。
- 工业 SVG：[Yue-plus/endfield_icons](https://github.com/Yue-plus/endfield_icons)。
- 钥匙图标：[Google Material Symbols](https://github.com/google/material-design-icons)，[Apache 2.0 许可证](../src/assets/material-symbols/LICENSE)。

## 当前验证题

「补给窗口 · 最大连续总和」参考[洛谷 P1115](https://www.luogu.com.cn/problem/P1115)的最大子段和题型，题面与评测数据独立编写。记录数最多 200000，单项绝对值最多 1000000；区间必须非空，答案须支持 64 位整数。标准解线性扫描，维护以当前位置结尾的最大和及全局最大值，可流式处理并只使用常数额外空间。所有 17 种语言的初始模板均为完整正确解，且小于 1024 字节。

服务端包含 28 组确定性测试：单元素、全负、全零、答案在首尾或内部、负数连接、频繁重置、32 位溢出，以及最大规模和固定种子随机数据。答案用前缀最小值法生成；本地测试再以区间穷举核对小数据，并验证常见错解被拒绝。200000 项最大规模用于区分线性与平方枚举；运行时限为每组 2 秒、基础内存限制为 256 MiB，内存合约另行收紧。
