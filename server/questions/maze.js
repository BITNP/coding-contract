import { defineQuestion, random } from './data.js'

const question = {
  id: 'maze',
  title: '迷宫寻路',
  category: '搜索 / 广度优先搜索',
  content: String.raw`## 题目描述

侦察队需要从起点 \`S\` 抵达撤离点 \`E\`。区域地图是一个 $r$ 行 $c$ 列的网格：\`.\` 表示可以通行，\`#\` 表示障碍，\`S\` 和 \`E\` 所在格子也可以通行。

每一步可以移动到上、下、左、右相邻的一格，不能进入障碍，也不能走出地图。求从 \`S\` 到 \`E\` 的最少步数；如果无法抵达，输出 $-1$。

## 输入格式

第一行两个整数 $r, c$。接下来 $r$ 行，每行一个长度为 $c$ 的字符串，只包含 \`.\`、\`#\`、\`S\`、\`E\`。地图中恰好有一个 \`S\` 和一个 \`E\`。

## 输出格式

输出一个整数，表示最少步数，无法抵达时输出 $-1$。

## 输入样例

~~~text
2 3
S#E
...
~~~

## 输出样例

~~~text
4
~~~

起点和终点之间有一格障碍。先向下，再向右走两步，最后向上抵达终点，共 $4$ 步。

## 数据范围

$1 \le r, c \le 100$，$r \times c \ge 2$。`,
}

function shortest(rows) {
  const width = rows[0].length
  const cells = rows.join('')
  const distance = new Int32Array(cells.length).fill(-1)
  const queue = [cells.indexOf('S')]
  distance[queue[0]] = 0
  for (const cell of queue) {
    if (cells[cell] === 'E') return distance[cell]
    const x = cell % width
    for (const next of [cell - width, cell + width, x > 0 ? cell - 1 : -1, x < width - 1 ? cell + 1 : -1]) {
      if (next < 0 || next >= cells.length || cells[next] === '#' || distance[next] >= 0) continue
      distance[next] = distance[cell] + 1
      queue.push(next)
    }
  }
  return -1
}

const makeCase = (rows) => ({
  input: `${rows.length} ${rows[0].length}\n${rows.join('\n')}\n`,
  answer: String(shortest(rows)),
})

const rng = random(0x3a2e)
const grid = (height, width, cell) =>
  Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => cell(y, x)).join(''))

function scattered(height, width, density) {
  const cells = Array.from({ length: height * width }, () => (rng.chance(density) ? '#' : '.'))
  const start = rng.int(0, cells.length - 1)
  let end = rng.int(0, cells.length - 2)
  if (end >= start) end++
  cells[start] = 'S'
  cells[end] = 'E'
  return Array.from({ length: height }, (_, y) => cells.slice(y * width, (y + 1) * width).join(''))
}

const serpentine = () => grid(100, 100, (y, x) => {
  if (y === 0 && x === 0) return 'S'
  if (y === 99 && x === 99) return 'E'
  if (y % 2 === 0) return '.'
  return (y % 4 === 1 ? x === 99 : x === 0) ? '.' : '#'
})

const fenced = (target) =>
  grid(100, 100, (y, x) => {
    if (y === 0 && x === 0) return target === 'S' ? 'E' : 'S'
    if (y === 50 && x === 50) return target
    return Math.max(Math.abs(y - 50), Math.abs(x - 50)) === 1 ? '#' : '.'
  })

export default defineQuestion(question, () => [
  ['S#E', '...'],
  ['S..#..', '.#.#.#', '.#...#', '.####.', '...#.E'],
  ['SE'],
  ['S', 'E'],
  ['S#E'],
  ['S#', '#E'],
  ['S..', '.#.', '..E'],
  ['S...', '###.', '....', '.###', '...E'],
  ['S' + '.'.repeat(98) + 'E'],
  ['S', ...Array(98).fill('.'), 'E'],
  grid(100, 100, (y, x) => (y === 0 && x === 0 ? 'S' : y === 99 && x === 99 ? 'E' : '.')),
  grid(100, 100, (y, x) => (y === 0 && x === 0 ? 'S' : y === 0 && x === 99 ? 'E' : x === 50 && y < 99 ? '#' : '.')),
  serpentine(),
  fenced('E'),
  fenced('S'),
  ...Array.from({ length: 12 }, (_, i) => scattered(2 + (i % 5), 3 + i, 0.25)),
  ...Array.from({ length: 4 }, (_, i) => scattered(100, 100, 0.2 + i * 0.06)),
].map(makeCase))
