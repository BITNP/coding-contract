# 活动长图模版

危机合约风格的活动长图模版，用 [Typst](https://typst.app) 排版。页面宽 600pt，字号按手机竖屏浏览设定。

## 编译

需要 Typst 0.13 及以上，以及 HarmonyOS Sans SC、JetBrains Mono 字体。没装的字体会自动退回其他字体，但效果会走样。

```sh
cd docs/poster
typst compile contract.typ contract.png --ppi 216   # 导出长图
typst watch contract.typ                             # 边改边预览（生成 PDF）
```

所有素材都在 `assets/` 里，不依赖仓库其他目录。

## 文件

| 文件 | 作用 |
| --- | --- |
| `contract.typ` | 活动长图正文，**改内容只改它** |
| `poster-template.typ` | 模版与全部组件（配色、字号、背景网格也在这里） |
| `assets/icons/`、`assets/indicators/` | 奖励图标、指标图标（指标文件名为「指标-等级」） |
| `assets/logo.svg` | 活动 logo（盾形外框 + `</>` + 开拓长矛），刊头、页尾、奖励图标共用；由 `tools/make-logo.py` 生成，线宽等尺寸都在脚本顶部 |
| `assets/make-emblem-glow.sh` | 由 logo 生成刊头的发光素材 |
| `tools/` | 维护用：`make-logo.py` 生成 logo，`fuzz.py` 找多余代码，`coverage.typ` 是它的覆盖用例 |

## 写法速查

文件开头导入模版，并填写刊头信息：

```typst
#import "poster-template.typ": *

#show: poster.with(
  title: [网协合约],
  subtitle: [开拓测试作战],
  kicker: [NET-PIONEER EXPERIMENTAL OPERATION\ CODING CONTRACT · 2026],
)
```

之后像写笔记一样写，样式自动套上：

| 写法 | 效果 |
| --- | --- |
| `= 活动介绍 <BRIEFING>` | 红色分区横幅；尖括号里是背景英文大字，可省略 |
| `#panel[ ... ]` | 深色内容面板，小节都写在里面 |
| `== 活动时间` | 黄色警示三角 + 「//活动时间」小节标题 |
| `- 内容` | 红色小旗列表项；行尾写 `\` 可换行接着写 |
| `*重点*` | 红字强调 |
| `#note[...]` | 灰色小字注释 |
| `#checklist[ - 条件一 - 条件二 ]` | 列表符号换成红色对勾 |
| `#tagline[...]` | 居中引言，两侧带菱形 |
| `#notice[...]` | 带锁图标的注意事项框 |
| `#chips("C++17", "Python 3")` | 等宽字小标签 |

### 图标格

```typst
#tiles(
  image("assets/logo.svg"),                                         // 只有图标
  (image("assets/icons/first-clear.webp"), [首通标记]),              // 图标 + 名称
  (icon: image("assets/indicators/ancient-3.webp"), label: [古法编程],
   selected: true, scale: 40%),                                      // 红底高亮、调整图标大小
)
```

默认排成居中的一行（最多 4 个）。多于 4 个时写 `columns: 4` 排成网格，`more: true` 在末尾加 `›››`。

### 回合卡

```typst
#rounds(
  round-card("I", [先遣], title: [最长升温])[说明文字],
  round-card("II", [三选一])[不写 title，题目显示为涂黑的格子],
)
```

### 刊头参数

`poster.with(...)` 可改的参数：

| 参数 | 含义 |
| --- | --- |
| `title`、`subtitle` | 大标题、副标题 |
| `org`、`org-en` | 左上角协会名称 |
| `kicker` | 右上角英文小字 |
| `tag` | 副标题下方进度条里的小字 |
| `ghost` | 背景两个英文大词，如 `("CONTINGENCY", "CONTRACT")` |
| `emblem` | 徽记；默认是由 `assets/logo.svg` 生成的发光徽记，也可传 `image("...")`（无发光） |
| `caption` | 每个分区横幅下的小字，`none` 为不显示 |
| `coda-word`、`coda-label`、`footer` | 页尾背景大字、小字和协会页脚 |

调整 logo 时改 `tools/make-logo.py` 顶部的尺寸常量并运行 `python3 tools/make-logo.py`；改了 logo 或想换别的徽记（白色、透明底，SVG 或 PNG 均可）后，再运行

```sh
sh assets/make-emblem-glow.sh            # 默认读取 assets/logo.svg
sh assets/make-emblem-glow.sh 新徽记.png   # 或指定其他图片
```

会覆盖 `assets/emblem-*.png`（需要 ffmpeg），`emblem` 保持默认即可。

## 常见问题

- **字太小 / 太大**：统一在 `poster-template.typ` 顶部的 `size-body`、`size-small` 等变量里调。
- **图片找不到**：`image("...")` 的路径相对于你正在编辑的 `.typ` 文件。
- **背景英文大字**：词比页面宽是正常的，设计上就是左右被裁切。
- **导出 PNG 时 Typst 崩溃**：`--ppi` 太低（如 30）时网点纹理会触发 Typst 的渲染 bug，用 72 以上即可。

## 维护：找出多余代码

改完模版后可以跑一遍变异测试：逐个删除行、代码块、命名参数或改动数值，重新渲染 `contract.typ` 和 `tools/coverage.typ`，与原图逐字节比对。渲染完全不变的改动会列在 `tools/fuzz-report.txt` 里，确认后即可删掉。

```sh
python3 tools/fuzz.py              # 约两三分钟
```

给模版加了新参数或新分支时，记得在 `tools/coverage.typ` 里用到它，否则会被误报为多余。
