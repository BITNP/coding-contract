import { defineQuestion, random, sequenceCases } from './data.js'

// 题型参考：洛谷 P1567，题面、范围和评测数据独立编写。
const question = {
  id: 'max-rise',
  title: '最长升温',
  category: '基础算法 / 模拟',
  content: String.raw`## 题目描述

温控站依次记录了 $n$ 次温度读数。请找出最长的一段连续读数，使这一段中每次读数都严格高于前一次，并输出这一段的长度。

单独一次读数也构成长度为 $1$ 的一段。相邻两次读数相等不算升温。

## 输入格式

第一行一个整数 $n$。接下来给出 $n$ 个整数 $t_1, t_2, \ldots, t_n$，各数以空白分隔。

## 输出格式

输出一个整数，表示最长连续升温段的长度。

## 输入样例

~~~text
9
2 3 3 4 5 6 1 2 3
~~~

## 输出样例

~~~text
4
~~~

第 $3$ 至第 $6$ 次读数 $3, 4, 5, 6$ 严格上升，长度为 $4$；第 $2$、$3$ 次读数相等，不能连成一段。

## 数据范围

$1 \le n \le 200000$，$-10^9 \le t_i \le 10^9$。`,
}

function longestRise(values) {
  let start = 0
  let longest = 1
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) start = i
    longest = Math.max(longest, i - start + 1)
  }
  return longest
}

const rng = random(0x51a7)
const rising = (length, start, step = 1) => Array.from({ length }, (_, i) => start + i * step)

export default defineQuestion(question, () => sequenceCases([
  [2, 3, 3, 4, 5, 6, 1, 2, 3],
  [7],
  [-1000000000],
  Array(200000).fill(5),
  rising(200000, -1000000000, 10000),
  rising(200000, 1000000000, -10000),
  [1, 2, 2, 3],
  [5, 4, 3, 1, 2, 3, 4, 5, 6],
  [1, 2, 3, 4, 5, 0, 1],
  [3, 1, 2, 1, 2, 3, 1],
  [-3, -2, -1, 0, 1, 1, 2],
  [10, 9, 10, 9, 10, 9],
  Array.from({ length: 200000 }, (_, i) => (i % 2 ? 1000000000 : -1000000000)),
  [...rng.ints(100000, -1000000000, 1000000000), ...rising(1000, 0, 7), ...rng.ints(98999, -5, 5)],
  [...rng.ints(150000, -1000000000, 1000000000), ...rising(50000, -1000000000, 40000)],
  ...Array.from({ length: 12 }, (_, i) => rng.ints(i * 6 + 2, -3, 3)),
  rng.ints(200000, -1000000000, 1000000000),
], longestRise))
