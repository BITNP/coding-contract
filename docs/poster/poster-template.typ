// =============================================================================
// 危机合约风格活动长图模版
//
// 示例：contract.typ　　速查：README.md
// 一般只需要在自己的 .typ 里 `#show: poster.with(...)`，然后像写笔记一样写：
//
//   = 分区标题 <ENGLISH>     红色分区横幅，尖括号里是背景英文大字（可省略）
//   #panel[ ... ]            深色内容面板
//   == 小节标题               黄色警示三角 + 「//小节标题」
//   - 列表项                  红色小旗项目符号
//   *重点*                    红字强调
//
// 其余组件（图标格、回合卡、语言标签等）见本文件「组件」部分。
// 页面宽 600pt，字号按手机竖屏浏览设定（与「赤石奖」长图相当），一般不必再调。
// =============================================================================

// 字体、字号与配色 ------------------------------------------------------------

#let primary = rgb("d11218")
#let ink = rgb("fafafa")
#let muted = rgb("a2a5a7")
#let page-background = rgb("101010")

#let body-font = ("HarmonyOS Sans SC", "Source Han Sans SC", "Noto Sans SC")
#let mono-font = ("JetBrains Mono", ..body-font)
#let wide-font = ("Arial", ..body-font) // 配合 900 字重即 Arial Black

#let size-body = 18pt // 正文
#let size-small = 14pt // 注释、图标名称、标签
#let size-tiny = 11pt // 英文装饰小字
#let size-subhead = 20pt // == 小节标题
#let size-section = 34pt // = 分区标题

#let signal-yellow = rgb("f4c21b")
#let hot-red = rgb("ff3a32")
#let panel-fill = rgb("1b1b1c")
#let poster-width = 600pt // 刊头按此宽度排版，不要修改

#let grid-thickness = 2pt
#let grid-unit = 6pt
#let grid-major-size = 16 * grid-unit
#let grid-offset = grid-unit * 6.5

// 技术网格背景 ----------------------------------------------------------------

#let technical-grid-background = {
  // 网格层：tiling 每格只画上边和左边两条线
  let lattice(size, stroke) = tiling(size: (size, size), {
    place(line(length: size, stroke: stroke))
    place(line(length: size, angle: 90deg, stroke: stroke))
  })
  // 大格中心的小十字
  let cross = tiling(size: (grid-major-size, grid-major-size), {
    let c = grid-major-size / 2
    let stroke = 0.6 * grid-thickness + rgb("212121")
    place(line(start: (c - grid-unit / 2, c), end: (c + grid-unit / 2, c), stroke: stroke))
    place(line(start: (c, c - grid-unit / 2), end: (c, c + grid-unit / 2), stroke: stroke))
  })
  let layer(fill, shift: 0pt) = place(
    dx: shift - grid-offset,
    dy: shift - grid-offset,
    rect(width: 100% + grid-offset, height: 100% + grid-offset, fill: fill),
  )
  layer(lattice(grid-unit, grid-thickness * 0.8 + rgb("121212")))
  layer(lattice(grid-major-size, grid-thickness + rgb("151515")))
  layer(cross, shift: grid-major-size / 2 + grid-thickness / 4)
}

// 协会页脚 --------------------------------------------------------------------

#let org-footer(name) = block(
  clip: true,
  grid(
    columns: (25%, 75%),
    rows: (3pt, 33pt),
    rect(width: 100%, fill: gradient.linear(
      rgb("9cd5dbe8"),
      rgb("86acc9ea"),
      rgb("75647fed"),
      rgb("b75663f5"),
      rgb("c5676dfa"),
    )),
    rect(width: 100%, fill: rgb("888888")),
    grid.cell(
      colspan: 2,
      fill: rgb("222222f8"),
      align(center + horizon, text(size: 13pt, fill: white.darken(10%), weight: "medium", name)),
    ),
  ),
)

// =============================================================================
// 基础图形（一般不需要直接使用）
// =============================================================================

// 把单色 SVG 换色后加载。
#let tinted-svg(path, from: "#e01313", to: "#ffffff", ..args) = image(
  bytes(read(path).replace(from, to)),
  ..args,
)

// 网点平铺，可直接作为文字填充，得到「网孔字」。
#let halftone(dot, step: 3pt, r: 0.9pt) = tiling(
  size: (step, step),
  place(dx: step / 2 - r, dy: step / 2 - r, circle(radius: r, fill: dot)),
)

// 渐变网点块：点径随位置衰减。falloff(x, y) 接收 0..1 的坐标，返回点径比例。
#let halftone-field(cols, rows, step: 4pt, r: 1.6pt, color: primary, falloff: (x, y) => 1 - x) = box(
  width: cols * step,
  height: rows * step,
  {
    for i in range(cols) {
      for j in range(rows) {
        let rr = r * falloff(i / (cols - 1), j / (rows - 1))
        if rr > 0.25pt {
          place(dx: i * step + step / 2 - rr, dy: j * step + step / 2 - rr, circle(radius: rr, fill: color))
        }
      }
    }
  },
)

// 背景大字：同一个词叠多层填充（实色、网点、渐隐……）。
// 先量出整词宽度再排版，词比页面宽时也不会折行，各层始终对齐。
#let ghost-word(word, size: 120pt, tracking: -0.03em, ..layers) = context {
  let t(fill) = text(
    size: size,
    font: wide-font,
    weight: 900,
    tracking: tracking,
    fill: fill,
    word,
  )
  let ls = layers.pos()
  box(width: measure(t(ls.at(0))).width, {
    t(ls.at(0))
    for l in ls.slice(1) { place(top + left, t(l)) }
  })
}

#let tri(s, fill: primary, stroke: none, flip: false) = if flip {
  polygon(fill: fill, stroke: stroke, (0pt, 0pt), (s, 0pt), (s / 2, s * 0.87))
} else {
  polygon(fill: fill, stroke: stroke, (0pt, s * 0.87), (s / 2, 0pt), (s, s * 0.87))
}

// 一排 n 个交替朝向的小三角（桁架），边长 s，filled 中的序号为实心。
// 先填实心三角，再统一描外框和内部斜线，共用的边只画一次，粗细一致。
#let tri-strip(n, s, filled, color: primary, weight: 1pt) = {
  let h = s * 0.87
  let pt(k) = (k * s / 2, if calc.odd(k) { 0pt } else { h }) // 偶数顶点在底边，奇数在顶边
  let stroke = (paint: color, thickness: weight, join: "miter")
  box(width: (n + 1) * s / 2, height: h, {
    for i in filled { place(polygon(fill: color, pt(i), pt(i + 1), pt(i + 2))) }
    let top = range(1, n + 2, step: 2)
    let bottom = range(2, n + 2, step: 2).rev()
    place(polygon(stroke: stroke, pt(0), ..top.map(pt), ..bottom.map(pt)))
    for k in range(1, n) { place(line(start: pt(k), end: pt(k + 1), stroke: stroke)) }
  })
}

#let warning-mark(size: 26pt) = box(width: size * 1.35, height: size, {
  place(dx: size * 0.38, polygon(
    fill: primary,
    (0pt, 0pt),
    (size * 0.9, 0pt),
    (size * 0.5, size * 0.8),
    (-size * 0.4, size * 0.8),
  ))
  place(polygon(fill: signal-yellow, (0pt, 0pt), (size, 0pt), (size / 2, size * 0.9)))
  place(dx: size * 0.42, dy: size * 0.06, text(size: size * 0.62, weight: "black", fill: black)[!])
})

#let flag-mark = box(width: 15pt, height: 11pt, baseline: -1pt, {
  place(polygon(fill: primary, (0pt, 0pt), (15pt, 0pt), (15pt, 11pt), (7.5pt, 8.2pt), (0pt, 11pt)))
  place(dx: 5.5pt, dy: 3pt, rect(width: 4pt, height: 4pt, fill: white))
})

#let check-mark = box(width: 16pt, height: 16pt, baseline: 2pt, fill: primary, {
  place(line(start: (3.2pt, 8.2pt), end: (6.7pt, 12pt), stroke: 2.4pt + white))
  place(line(start: (6.7pt, 12pt), end: (13pt, 3.8pt), stroke: 2.4pt + white))
})

#let lock-mark = box(width: 26pt, height: 28pt, fill: rgb("e8e8e8"), {
  place(dx: 7.5pt, dy: 4pt, rect(width: 11pt, height: 11pt, radius: (top: 5.5pt), stroke: 2.2pt + rgb("1a1a1a")))
  place(dx: 5pt, dy: 12pt, rect(width: 16pt, height: 11pt, fill: rgb("1a1a1a")))
})

// 图片参数既可以是 image("路径")，也可以是路径字符串（相对本模版文件）。
#let as-image(icon) = if type(icon) == str { image(icon) } else { icon }

#let fit-image(icon, width, height) = box(width: width, height: height, {
  set image(width: 100%, height: 100%, fit: "contain")
  align(center + horizon, as-image(icon))
})

// 十字小装饰。
#let crosses(n: 4, size: 7pt, color: rgb("ffffff40")) = stack(
  dir: ltr,
  spacing: size * 1.6,
  ..range(n).map(_ => box(width: size, {
    place(center + horizon, line(length: size, stroke: 1pt + color))
    place(center + horizon, line(length: size, angle: 90deg, stroke: 1pt + color))
  })),
)

// =============================================================================
// 组件
// =============================================================================

// 红字强调。正文里写 *文字* 效果相同。
#let hl(body) = text(fill: hot-red, weight: "medium", body)

// 灰色小字注释。
#let note(body) = text(size: size-small, fill: muted, body)

// 把其中的列表符号换成红色对勾：#checklist[ - 条件一 - 条件二 ]
#let checklist(body) = {
  set list(marker: check-mark)
  body
}

// 小节标题。正文里写 == 标题 效果相同。
#let subhead(title) = block(above: 30pt, below: 16pt, grid(
  columns: (auto, 1fr),
  column-gutter: 6pt,
  align: horizon,
  warning-mark(),
  box(width: 100%, height: 30pt, fill: gradient.linear(
    (rgb("ececec"), 0%),
    (rgb("ececec"), 30%),
    (rgb("ececec00"), 75%),
    (rgb("ececec00"), 100%),
  ), {
    place(left + horizon, dx: 8pt, text(size: size-subhead, weight: "bold", fill: rgb("141414"))[\/\/#title])
    place(right + horizon, crosses())
  }),
))

// 分区横幅。正文里写 = 标题 <ENGLISH> 效果相同。
#let section(title, en: "CONTRACT", caption: [BITNP · CODING CONTRACT]) = block(
  inset: (top: 52pt, bottom: 34pt),
  {
    place(center + horizon, dy: -6pt, ghost-word(
      upper(en),
      size: 76pt,
      tracking: 0.02em,
      rgb("ffffff05"),
      halftone(rgb("ffffff16"), step: 3.5pt, r: 0.95pt),
    ))
    place(left + horizon, dx: 24pt, dy: -40pt, tri-strip(7, 10pt, (1, 4)))
    place(right + horizon, dx: -24pt, dy: 38pt, tri-strip(7, 10pt, (2, 3)))
    grid(
      columns: (1fr, auto, 1fr),
      align: horizon,
      rect(width: 100%, height: 28pt, fill: gradient.linear(rgb("a40a0c00"), rgb("a40a0ccc"))),
      box(inset: (x: 5pt), {
        place(left + horizon, dx: -5pt, rect(width: 4pt, height: 62pt, fill: white))
        place(right + horizon, dx: 5pt, rect(width: 4pt, height: 62pt, fill: white))
        box(
          fill: gradient.linear(rgb("8f0a0c"), primary, rgb("8f0a0c")),
          inset: (x: 32pt, y: 13pt),
          stack(
            dir: ltr,
            spacing: 14pt,
            tinted-svg("assets/heading-mark.svg", height: size-section * 0.85),
            text(size: size-section, weight: "bold", tracking: 3pt, title),
          ),
        )
      }),
      rect(width: 100%, height: 28pt, fill: gradient.linear(rgb("a40a0ccc"), rgb("a40a0c00"))),
    )
    if caption != none {
      v(8pt)
      align(center, text(size: size-tiny, fill: rgb("8a8a8a"), tracking: 4pt, font: mono-font, caption))
    }
  },
)

// 分区开头的居中引言，两侧带白色菱形。
#let tagline(body) = block(inset: (x: 28pt, bottom: 30pt), align(center, {
  set par(leading: 0.8em)
  set text(weight: "medium")
  let diamond = box(baseline: -1pt, rotate(45deg, rect(width: 8pt, height: 8pt, fill: white)))
  grid(columns: (auto, 1fr, auto), column-gutter: 14pt, align: horizon, diamond, body, diamond)
}))

// 深色斜纹内容面板，右上角红白黄三色签。
#let panel(body) = block(inset: (x: 18pt), block(
  fill: tiling(size: (8pt, 8pt), {
    place(rect(width: 8pt, height: 8pt, fill: panel-fill))
    place(line(start: (0pt, 8pt), end: (8pt, 0pt), stroke: 0.4pt + rgb("ffffff07")))
  }),
  stroke: 1pt + rgb("3b3b3c"),
  inset: (x: 20pt, top: 14pt, bottom: 30pt),
  {
    place(top + right, dx: 21pt, dy: -22pt, stack(
      dir: ltr,
      rect(width: 16pt, height: 8pt, fill: primary),
      rect(width: 12pt, height: 8pt, fill: white),
      rect(width: 12pt, height: 8pt, fill: signal-yellow),
    ))
    place(bottom + left, dx: -20pt, dy: 30pt, rect(width: 100% + 40pt, height: 90pt, fill: gradient.linear(
      rgb("8a0a0c00"),
      rgb("8a0a0c40"),
      angle: 90deg,
    )))
    place(top + left, dx: -21pt, dy: -15pt, rect(width: 4pt, height: 60pt, fill: primary))
    place(bottom + right, dx: 20pt, dy: 30pt, halftone-field(
      40,
      14,
      color: rgb("ff2a2a2a"),
      falloff: (x, y) => x * y,
    ))
    place(top + left, dx: -20pt, dy: -14pt, halftone-field(
      26,
      9,
      r: 1.4pt,
      color: rgb("ffffff10"),
      falloff: (x, y) => (1 - x) * (1 - y),
    ))
    body
  },
))

// 带锁图标的注意事项框。
#let notice(body) = block(above: 28pt, grid(
  columns: (auto, 1fr),
  column-gutter: 10pt,
  lock-mark,
  block(width: 100%, fill: rgb("0c0c0c"), stroke: (bottom: 3pt + primary), inset: (x: 14pt, y: 12pt), {
    set text(size: size-small + 1pt, fill: rgb("c9c9c9"))
    body
    place(bottom + right, dx: 9pt, dy: 7pt, rect(width: 5pt, height: 5pt, fill: primary))
  }),
))

// 红框发光图标格，由 tiles 调用。
#let tile(icon, size, selected, scale) = box(width: size, height: size, {
  // 辉光：五层逐渐收紧的半透明外框
  for i in range(5) {
    place(rect(width: 100%, height: 100%, outset: size / 10 * (5 - i) / 5, fill: primary.transparentize(91% - 9% * i)))
  }
  place(rect(
    width: 100%,
    height: 100%,
    fill: if selected { gradient.linear(rgb("b81716"), rgb("a10810"), angle: 65deg) } else { rgb("0d0d0e") },
    stroke: 2pt + rgb("f02023"),
  ))
  place(rect(width: 100%, height: 100%, stroke: 0.6pt + rgb("ff272755")))
  // 四角短线
  for (corner, dir) in ((top + left, 1), (top + right, 1), (bottom + left, -1), (bottom + right, -1)) {
    place(corner, line(length: size / 10, stroke: 2pt + rgb("ff2727")))
    place(corner, line(length: size / 10, angle: 90deg * dir, stroke: 2pt + rgb("ff2727")))
  }
  place(center + horizon, fit-image(icon, size * scale, size * scale))
})

// 一组图标格。每一项可以写成：
//   image("a.png")                                  只有图标
//   (image("a.png"), [名称])                          图标 + 下方名称
//   (icon: image("a.png"), label: [名称], selected: true, scale: 40%)
// columns: auto 时排成居中的一行；写数字则按列数排成网格。more: true 在末尾加 ››› 箭头。
#let tiles(columns: auto, size: 84pt, gap: 26pt, more: false, ..items) = {
  let spec(it) = if type(it) == array {
    (icon: it.at(0), label: it.at(1))
  } else if type(it) == dictionary { it } else { (icon: it) }
  let cells = items
    .pos()
    .map(it => {
      let s = spec(it)
      let t = tile(s.icon, size, s.at("selected", default: false), s.at("scale", default: 58%))
      let label = s.at("label", default: none)
      if label == none { t } else { stack(spacing: 12pt, t, text(size: size-small, fill: rgb("d4d4d4"), label)) }
    })
  if more {
    cells.push(box(height: size, align(horizon, text(size: 40pt, weight: "black", fill: primary)[›››])))
  }
  block(width: 100%, above: 26pt, below: 28pt, if columns == auto {
    align(center, stack(dir: ltr, spacing: gap, ..cells))
  } else {
    grid(columns: (1fr,) * columns, row-gutter: 22pt, align: center + top, ..cells)
  })
}

// 回合卡（横向一行一张）。不写 title 时题目显示为涂黑的格子（未解锁）。
//   #round-card("I", [先遣], title: [最长升温])[说明文字]
#let round-card(numeral, label, title: none, hidden-chars: 4, body) = block(
  fill: rgb("121213"),
  stroke: (left: 4pt + primary, rest: 0.8pt + rgb("3a3a3a")),
  inset: (x: 16pt, y: 14pt),
  {
    place(right + horizon, dx: 4pt, ghost-word(
      numeral,
      size: 80pt,
      tracking: 0.04em,
      rgb("ffffff07"),
      halftone(rgb("ffffff1c"), step: 3.5pt, r: 0.95pt),
    ))
    grid(
      columns: (148pt, 1fr),
      column-gutter: 14pt,
      align: (left + horizon, left + horizon),
      {
        text(size: size-tiny, fill: hot-red, font: mono-font, tracking: 2pt)[ROUND #numeral]
        h(6pt)
        text(size: size-small, fill: muted, label)
        v(-4pt)
        if title == none {
          stack(dir: ltr, spacing: 4pt, ..range(hidden-chars).map(_ => rect(
            width: 28pt,
            height: 30pt,
            fill: rgb("2c2c2d"),
            stroke: 0.8pt + rgb("4a4a4a"),
          )))
        } else {
          text(size: 30pt, weight: "black", title)
        }
      },
      text(size: size-small + 1pt, fill: rgb("c4c4c4"), body),
    )
  },
)

// 把若干回合卡竖向排列。
#let rounds(..cards) = block(above: 20pt, below: 20pt, stack(spacing: 10pt, ..cards.pos()))

// 等宽字小标签，适合语言、标签列表：#chips("C++17", "Python 3")
#let chips(..names) = {
  set par(leading: 0.75em)
  names
    .pos()
    .map(name => box(
      inset: (x: 9pt, y: 6pt),
      stroke: 0.8pt + rgb("5d5e60"),
      fill: rgb("121314"),
      text(size: size-small, font: mono-font, fill: rgb("dcdcdc"), name),
    ))
    .join(h(7pt))
}

// =============================================================================
// 刊头与收尾
// =============================================================================

// 默认徽记由三层素材叠成（外发光 / 红边 / 金属白），
// 换徽记时运行 `sh assets/make-emblem-glow.sh 新徽记.png` 重新生成即可。
#let default-emblem(width) = {
  let canvas = width * 640 / 360
  box(width: width, height: width, {
    for layer in ("glow", "rim", "metal") {
      place(center + horizon, image("assets/emblem-" + layer + ".png", width: canvas))
    }
  })
}

#let masthead(
  title: [网协合约],
  subtitle: [开拓测试作战],
  org: [北京理工大学网络开拓者协会],
  org-en: [BIT NET PIONEER],
  kicker: [NET-PIONEER EXPERIMENTAL OPERATION],
  tag: [\/\/ BITNP: CODING CONTRACT],
  ghost: ("CONTINGENCY", "CONTRACT"),
  emblem: auto,
) = block(width: 100%, height: 500pt, clip: true, {
  let (w1, w2) = ghost

  // 底色与红色雾
  place(rect(width: 100%, height: 100%, fill: rgb("0d0909")))
  place(dx: -150pt, dy: -170pt, circle(radius: 450pt, fill: gradient.radial(
    (rgb("8a0c10aa"), 0%),
    (rgb("4a080a66"), 45%),
    (rgb("1a080800"), 100%),
  )))

  // 钢梁暗影
  let beam(shade, ..pts) = place(polygon(
    fill: gradient.linear(shade, rgb("0d0909"), angle: 90deg),
    stroke: 0.6pt + rgb("ffffff10"),
    ..pts,
  ))
  beam(rgb("2a2222"), (-20pt, 340pt), (260pt, 250pt), (300pt, 268pt), (-20pt, 380pt))
  beam(rgb("2a2020"), (330pt, 440pt), (620pt, 320pt), (620pt, 356pt), (360pt, 468pt))
  beam(rgb("231b1b"), (440pt, 500pt), (490pt, 400pt), (520pt, 404pt), (472pt, 520pt))
  beam(rgb("231b1b"), (-20pt, 470pt), (120pt, 440pt), (130pt, 460pt), (-20pt, 496pt))

  // 背景大字：上暗下亮，带网孔；每行左右都超出页面
  place(top + center, dy: -46pt, ghost-word(
    w1,
    size: 150pt,
    rgb("2b1314"),
    halftone(rgb("00000040")),
  ))
  place(top + center, dx: -40pt, dy: 102pt, ghost-word(
    w2,
    size: 124pt,
    rgb("4e0a0d"),
    halftone(rgb("8c1418"), r: 0.95pt),
    gradient.linear((rgb("6a0c0f00"), 0%), (rgb("6a0c0f00"), 40%), (rgb("6a0c0f"), 100%)),
  ))
  place(top + center, dy: 262pt, ghost-word(
    w1,
    size: 104pt,
    rgb("9c1117"),
    halftone(rgb("d6262a"), r: 0.95pt),
    gradient.linear((rgb("b8141a00"), 0%), (rgb("b8141a"), 34%), (rgb("b8141a"), 60%), (rgb("b8141a00"), 100%)),
  ))
  place(top + center, dx: 30pt, dy: 392pt, ghost-word(
    w2,
    size: 92pt,
    rgb("220d0e"),
    halftone(rgb("4f0e10")),
  ))

  // 网点渐变块
  place(top + right, halftone-field(40, 22, r: 1.7pt, color: rgb("ff2a2a48"), falloff: (x, y) => x * (1 - y)))
  place(top + left, dy: 236pt, halftone-field(26, 12, color: rgb("ff2a2a38"), falloff: (x, y) => (1 - x) * 0.9))
  place(bottom + left, dx: 330pt, dy: -60pt, halftone-field(
    40,
    9,
    r: 1.5pt,
    color: rgb("ffffff14"),
    falloff: (x, y) => calc.sin(x * 3.14) * (1 - y),
  ))

  // 三角碎片：(x, y, 边长, 倒置, 空心)
  for (x, y, s, f, o) in (
    (64pt, 196pt, 22pt, false, false),
    (106pt, 340pt, 30pt, true, false),
    (488pt, 214pt, 26pt, false, false),
    (530pt, 262pt, 12pt, true, false),
    (470pt, 352pt, 36pt, true, true),
    (556pt, 380pt, 18pt, false, false),
    (402pt, 152pt, 10pt, true, true),
    (176pt, 130pt, 12pt, false, true),
  ) {
    place(dx: x, dy: y, tri(s, flip: f, fill: if o { none } else { primary }, stroke: if o { 1.2pt + primary }))
  }
  place(dx: 24pt, dy: 268pt, tri-strip(14, 10pt, (3, 4, 9)))
  place(dx: 440pt, dy: 188pt, tri-strip(12, 8pt, (1, 6, 7)))

  // 顶栏
  place(top + left, dx: 20pt, dy: 18pt, text(size: size-tiny, fill: rgb("ffffffa0"), tracking: 1pt)[
    #org\ #text(font: mono-font, fill: rgb("ffffff60"), org-en)
  ])
  place(top + right, dx: -20pt, dy: 18pt, align(right, text(
    size: size-tiny - 1pt,
    fill: rgb("ffffff70"),
    font: mono-font,
    kicker,
  )))

  // 徽记
  place(top + center, dy: 30pt, circle(radius: 150pt, fill: gradient.radial(
    (rgb("ff1e1e30"), 0%),
    (rgb("d1121810"), 50%),
    (rgb("d1121800"), 100%),
  )))
  place(top + center, dy: 80pt, if emblem == auto { default-emblem(180pt) } else {
    fit-image(emblem, 180pt, 180pt)
  })

  // 标题（自上而下渐隐）+ 紧贴的副标题 + 进度条装饰
  place(top + center, dy: 290pt, stack(
    spacing: 10pt,
    align(center, box(text(
      size: 84pt,
      weight: 900,
      tracking: 4pt,
      top-edge: "bounds",
      bottom-edge: "bounds",
      fill: gradient.linear(
        (white, 0%),
        (white, 40%),
        (rgb("ffffffa0"), 75%),
        (rgb("ffffff30"), 100%),
        angle: 90deg,
      ),
      title,
    ))),
    align(center, text(
      size: 30pt,
      weight: "medium",
      tracking: 4pt,
      top-edge: "bounds",
      bottom-edge: "bounds",
      fill: white,
      subtitle,
    )),
    v(6pt),
    align(center, box(width: 400pt, height: 12pt, {
      place(left + horizon, rect(width: 22pt, height: 10pt, fill: primary))
      place(left + horizon, dx: 4pt, rect(width: 10pt, height: 4pt, fill: rgb("3a0405")))
      place(left + horizon, dx: 30pt, text(size: 9pt, fill: rgb("ffffff90"), font: mono-font, tag))
      place(left + horizon, dx: 196pt, line(length: 128pt, stroke: 1pt + rgb("ffffff30")))
      place(right + horizon, rect(width: 60pt, height: 4pt, fill: primary))
      place(right + horizon, dx: -66pt, rect(width: 4pt, height: 4pt, fill: primary))
    })),
  ))

  // 底部渐隐到页面底色
  place(bottom, rect(width: 100%, height: 50pt, fill: gradient.linear(rgb("10101000"), page-background, angle: 90deg)))
  place(bottom, dy: -1pt, rect(width: 100%, height: 2pt, fill: gradient.linear(
    (primary.transparentize(100%), 0%),
    (primary, 50%),
    (primary.transparentize(100%), 100%),
  )))
})

// 页尾的巨型背景字与小徽标。
#let coda(word: "CONTRACT", label: [END OF BRIEFING], emblem: auto) = block(width: 100%, height: 140pt, clip: true, {
  place(center + horizon, ghost-word(
    word,
    size: 110pt,
    rgb("ffffff05"),
    halftone(rgb("ffffff12"), step: 3.5pt, r: 0.95pt),
  ))
  place(left + bottom, dx: 20pt, dy: -20pt, stack(
    dir: ltr,
    spacing: 10pt,
    if emblem == auto { image("assets/logo.svg", height: 24pt) } else if emblem != none {
      fit-image(emblem, 24pt, 24pt)
    },
    box(baseline: -6pt, line(length: 80pt, stroke: 1pt + rgb("ffffff55"))),
    box(baseline: -3pt, text(size: size-tiny, fill: rgb("ffffff60"), font: mono-font, label)),
  ))
})

// =============================================================================
// 整页模版：#show: poster.with(...)
// =============================================================================

#let poster(
  // 刊头
  title: [网协合约],
  subtitle: [开拓测试作战],
  org: [北京理工大学网络开拓者协会],
  org-en: [BIT NET PIONEER],
  kicker: [NET-PIONEER EXPERIMENTAL OPERATION],
  tag: [\/\/ BITNP: CODING CONTRACT],
  ghost: ("CONTINGENCY", "CONTRACT"),
  emblem: auto,
  // 分区横幅下的小字；none 表示不显示
  caption: [BITNP · CODING CONTRACT],
  // 页尾
  coda-word: "CONTRACT",
  coda-label: [END OF BRIEFING],
  footer: [北京理工大学网络开拓者协会],
  body,
) = {
  set document(title: title, author: "北京理工大学网络开拓者协会")
  set page(
    width: poster-width,
    height: auto,
    margin: 0pt,
    fill: page-background,
    background: technical-grid-background,
  )
  set text(font: body-font, lang: "zh", size: size-body, fill: ink)
  set par(justify: true, leading: 0.7em, spacing: 1em)
  set list(marker: flag-mark, body-indent: 10pt, spacing: 0.9em)
  show raw: set text(font: mono-font)
  show strong: it => hl(it.body)
  show heading.where(level: 1): it => {
    let label = it.at("label", default: none)
    section(it.body, en: if label == none { "CONTRACT" } else { str(label) }, caption: caption)
  }
  show heading.where(level: 2): it => subhead(it.body)

  masthead(
    title: title,
    subtitle: subtitle,
    org: org,
    org-en: org-en,
    kicker: kicker,
    tag: tag,
    ghost: ghost,
    emblem: emblem,
  )
  body
  coda(word: coda-word, label: coda-label, emblem: emblem)
  org-footer(footer)
}
