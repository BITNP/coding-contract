// =============================================================================
// 网协合约 · 开拓测试作战 活动长图
//
// 编译：typst compile contract.typ contract.png --ppi 216
// 只需修改本文件；写法速查见 README.md，组件实现在 poster-template.typ。
// =============================================================================

#import "poster-template.typ": *

#show: poster.with(
  title: [网协合约],
  subtitle: [开拓测试作战],
  kicker: [NET-PIONEER EXPERIMENTAL OPERATION\ CODING CONTRACT · 2026],
)

// 「= 标题 <英文>」生成红色分区横幅，尖括号里的英文是背景大字，可省略。
= 活动介绍 <BRIEFING>

#tagline[
  大模型正在接管键盘，AGI 依旧遥遥无期。\
  网协空间检测到异常指标……请管理员亲手完成这份合约。
]

#panel[
  == 活动时间
  // TODO 发布前核对时间
  - 2026/11/29 14:00 – 2026/12/06 23:59 \
    #note[※ 作战入口：`oj.bitnp.net`，开放期间可多次出击，以最高得分计入排行。]

  == 开放条件
  #checklist[
    - 热爱代码和编程
    - 持有网协统一认证账号
    - 能接受 60 分钟内*不离开全屏*
  ]

  == 活动奖励
  - 活动期间，达成作战目标可在排行榜上留下*【风险等级】*，并获得*【首通标记】*等荣誉。

  #tiles(
    (image("assets/logo.svg"), [合约徽记]),
    (icon: image("assets/icons/risk-level.webp"), label: [风险等级], scale: 46%),
    (icon: image("assets/icons/first-clear.webp"), label: [首通标记], scale: 40%),
    (icon: image("assets/icons/cc-mark.webp"), label: [合约标识], scale: 62%),
  )

  #notice[
    为便于管理员冲击排行，「开拓测试作战」在活动结束前不限出击次数。指标与语言在作战中可随时调整，但*环境：时限*与*环境：感官遮蔽*在行动开始后锁定，请谨慎选择。
  ]
]

= 本期内容 <OPERATION>

#panel[
  == 作战流程
  - 每场作战*三选一*，基础时限 60 分钟。提交通过前可随时切题，草稿按题目和编程语言分别保存。

  #choices(
    choice-card("A", [顺序扫描], [最长升温])[找出连续严格升温的最长记录。],
    choice-card("B", [排序贪心], [信道排班])[在一条信道上安排尽可能多的传输请求。],
    choice-card("C", [网格搜索], [迷宫寻路])[绕过障碍，求出抵达终点的最少步数。],
  )

  - 任意一题*通过全部测试点并满足所选指标*即结束作战，得分为该次提交的指标等级之和。放弃或超时未通过记 0 分。

  == 指标更新
  // 图标都在 assets/indicators/，文件名是「指标-等级」。
  #tiles(
    columns: 4,
    more: true,
    (image("assets/indicators/time-3.webp"), [环境：时限]),
    (image("assets/indicators/source-3.webp"), [存储枯竭]),
    (image("assets/indicators/lines-1.webp"), [十行代码]),
    (image("assets/indicators/brackets-1.webp"), [订书钉]),
    (icon: image("assets/indicators/ancient-3.webp"), label: [古法编程], selected: true),
    (image("assets/indicators/shrink-3.webp"), [谜语人]),
    (image("assets/indicators/memory-3.webp"), [内存枯竭]),
    (image("assets/indicators/linear-3.webp"), [线性思维]),
    (image("assets/indicators/vowels-1.webp"), [失语症]),
    (image("assets/indicators/arithmetic-3.webp"), [低等数学]),
    (image("assets/indicators/senses-3.webp"), [感官遮蔽]),
  )

  - 新增 11 类「指标」，主要涵盖*限制命名与语法结构*、*压缩代码与内存体积*以及*改变编辑环境*等。
  - *古法编程 III*（禁用大模型及代码补全）是开启谜语人、内存枯竭、线性思维、失语症、低等数学的*关键指标*。
  - 管理员可以根据自身的代码风格和语言选择，灵活尝试不同的指标组合，*挑战更高的风险等级*！

  == 支持语言
  #chips(
    "C++17", "C17", "Python 3", "Java 21", "JavaScript", "TypeScript", "Go", "Rust 2021", "C# (Mono)",
    "Kotlin", "Swift", "PHP 8", "Ruby", "Lua 5.4", "Perl", "R", "Bash",
  )

  #notice[※ 更多指标细节请前往活动内查看。部分指标仅对特定语言开放。]
]
