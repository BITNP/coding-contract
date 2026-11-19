#!/usr/bin/env python3
"""生成 assets/logo.svg：盾形外框 + </> + 贯穿的开拓长矛。

所有尺寸集中在下面的常量里，改完运行：
    python3 tools/make-logo.py && sh assets/make-emblem-glow.sh
"""

import math
import os

# 线宽体系（画布 360×360）
SHIELD = 16  # 盾框线宽
BRACKET = 20  # < > 线宽
GAP = 9  # 长矛穿过其他部件时两侧留出的缝
SHAFT = 16  # 矛杆宽度（与盾框一致）

# 长矛轴线：经过 C，向右上倾斜 TILT 度
C = (180, 196)
TILT = 13

# 沿轴线的位置 t（向上为正）与偏移 w（向右为正）
POMMEL = (-81, 11, 11)  # 尾端菱形：中心 t、半长、半宽（与盾底保持距离）
SHAFT_SPAN = (-75, 46)
SOCKET = (46, 56, 64, 12)  # 矛头插口：起点、变宽处、终点、最大半宽
BLADE = dict(base=67, neck=10, widest=96, half=31, tip=178, ridge=2)

SHIELD_TOP, SHIELD_LEFT, SHIELD_SIDE_END, CHAMFER = 64, 44, 206, 30
SIDE_BREAK = SHIELD_SIDE_END - 2 * GAP  # 竖边在此结束，与底部 V 形之间留缝
BRACKET_REACH = 52  # 括号臂的水平/竖直跨度（45°）
BRACKET_INNER = 140  # 括号开口的 x（左侧；右侧对称）

d = (math.sin(math.radians(TILT)), -math.cos(math.radians(TILT)))
n = (math.cos(math.radians(TILT)), math.sin(math.radians(TILT)))


def P(t, w=0.0):
    return (C[0] + d[0] * t + n[0] * w, C[1] + d[1] * t + n[1] * w)


def pts(points):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in points)


def mirror(points):
    return [(360 - x, y) for x, y in points]


# ---- 长矛 ----
spear = []
t, hl, hw = POMMEL
spear.append([P(t - hl), P(t, hw), P(t + hl), P(t, -hw)])
a, b = SHAFT_SPAN
spear.append([P(a, -SHAFT / 2), P(a, SHAFT / 2), P(b, SHAFT / 2), P(b, -SHAFT / 2)])
a, m, b, w = SOCKET
spear.append([P(a, -SHAFT / 2), P(a, SHAFT / 2), P(m, w), P(b, w), P(b, -w), P(m, -w)])
B = BLADE
for side in (-1, 1):  # 叶形矛头，中间留一道棱线分成两半
    spear.append([
        P(B["base"], side * B["ridge"]),
        P(B["base"], side * B["neck"]),
        P(B["widest"], side * B["half"]),
        P(B["tip"], 0),
    ])

# ---- 盾框 ----
L, T, R = SHIELD_LEFT, SHIELD_TOP, 360 - SHIELD_LEFT
bottom = (180, SHIELD_SIDE_END + (180 - L))  # 45° 收向底尖
shield_top = [(L, SIDE_BREAK), (L, T + CHAMFER), (L + CHAMFER, T), (R - CHAMFER, T), (R, T + CHAMFER), (R, SIDE_BREAK)]
shield_bottom = [(L, SHIELD_SIDE_END), bottom, (R, SHIELD_SIDE_END)]

# ---- </ > ----
cy = C[1]
left_bracket = [(BRACKET_INNER, cy - BRACKET_REACH), (BRACKET_INNER - BRACKET_REACH, cy), (BRACKET_INNER, cy + BRACKET_REACH)]

poly = lambda p, extra="": f'<polygon points="{pts(p)}"{extra}/>'
line = lambda p: f'<polyline points="{pts(p)}"/>'

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360">
  <!-- 由 tools/make-logo.py 生成：盾框 {SHIELD}、括号 {BRACKET}、矛杆 {SHAFT}，长矛两侧留缝 {GAP} -->
  <defs>
    <mask id="spear-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="360">
      <rect width="360" height="360" fill="#fff"/>
      <g fill="#000" stroke="#000" stroke-width="{GAP * 2}" stroke-linejoin="round">
        {"".join(poly(p) for p in spear)}
      </g>
    </mask>
  </defs>
  <g mask="url(#spear-gap)" fill="none" stroke="#fff" stroke-linejoin="miter" stroke-miterlimit="4">
    <g stroke-width="{SHIELD}">
      {line(shield_top)}
      {line(shield_bottom)}
    </g>
    <g stroke-width="{BRACKET}">
      {line(left_bracket)}
      {line(mirror(left_bracket))}
    </g>
  </g>
  <g fill="#fff">
    {"".join(poly(p) for p in spear)}
  </g>
</svg>
"""

out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "logo.svg")
with open(out, "w", encoding="utf-8") as f:
    f.write(svg)
print(out)
