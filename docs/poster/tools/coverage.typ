// fuzz.py 的覆盖用例：把 contract.typ 没用到的参数和分支都走一遍。
// 单独预览：typst compile --root . tools/coverage.typ
#import "../poster-template.typ": *

#show: poster.with(
  title: [覆盖测试],
  subtitle: [全部参数],
  org: [组织名称],
  org-en: [ORG NAME],
  kicker: [KICKER LINE],
  tag: [\/\/ TAG TEXT],
  ghost: ("ALPHA", "BETA"),
  emblem: image("../assets/icons/risk-level.webp"),
  caption: none,
  coda-word: "OMEGA",
  coda-label: [CODA LABEL],
  footer: [页脚文字],
)

= 无标签分区

#section([手动分区], en: "MANUAL", caption: [手动小字])

#tagline[引言文字]

#panel[
  #subhead[手动小节]
  - 列表 *强调* #hl[高亮] #note[注释] `raw`
  #checklist[- 对勾]
  #tiles(
    "assets/indicators/time-1.webp",
    (icon: "assets/indicators/time-2.webp", selected: true, scale: 40%),
  )
  #tiles(columns: 3, size: 60pt, gap: 10pt, (image("../assets/indicators/time-3.webp"), [名称]))
  #chips("A", "B")
  #notice[注意]
]
