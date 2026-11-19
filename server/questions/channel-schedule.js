import { defineQuestion, random } from './data.js'

const question = {
  id: 'channel-schedule',
  title: '信道排班',
  category: '贪心 / 区间调度',
  content: String.raw`## 题目描述

中继站只有一条信道，共收到 $n$ 个传输请求。第 $i$ 个请求必须从时刻 $s_i$ 开始，持续占用信道直到时刻 $e_i$。请求的时间固定，选中的请求必须完整执行。

每个请求占用半开区间 $[s_i, e_i)$。前一请求结束的时刻可以立即开始下一个请求。求这条信道最多可以完成多少个请求。

## 输入格式

第一行是整数 $n$。接下来 $n$ 行，每行两个整数 $s_i$ 和 $e_i$。请求的输入顺序任意。

## 输出格式

输出一个整数，表示最多可以完成的请求数。

## 输入样例

~~~text
5
3 5
0 9
7 9
1 4
4 7
~~~

## 输出样例

~~~text
3
~~~

依次安排第 $4$、第 $5$、第 $3$ 个请求，它们在时刻 $4$ 和 $7$ 交接，共完成 $3$ 个请求。

## 数据范围

$0 \le n \le 200000$，$0 \le s_i < e_i \le 10^9$。`,
}

function makeCase(requests) {
  let available = 0
  let count = 0
  for (const [start, end] of requests.toSorted((a, b) => a[1] - b[1])) {
    if (start >= available) {
      available = end
      count++
    }
  }
  return {
    input: [requests.length, ...requests.map((request) => request.join(' '))].join('\n') + '\n',
    answer: String(count),
  }
}

const rng = random(0x9e37)
const randomRequests = (count, last, maxLength) =>
  Array.from({ length: count }, () => {
    const start = rng.int(0, last - 1)
    return [start, start + rng.int(1, Math.min(last - start, maxLength))]
  })

export default defineQuestion(question, () => [
  [[3, 5], [0, 9], [7, 9], [1, 4], [4, 7]],
  [],
  [[0, 1]],
  [[999999999, 1000000000]],
  [[0, 1000000000], [1, 2], [4, 5], [6, 7]],
  [[0, 5], [4, 6], [5, 10]],
  [[3, 4], [2, 3], [1, 2], [0, 1]],
  [[1, 5], [1, 5], [1, 5]],
  [[1, 9], [1, 3], [3, 9], [9, 10]],
  [[0, 6], [2, 4], [1, 5], [3, 4], [0, 1]],
  [[0, 10], [12, 21], [2, 3], [3, 4], [9, 10], [10, 12]],
  ...Array.from({ length: 12 }, (_, i) => randomRequests(i + 1, 24, 10)),
  Array.from({ length: 200000 }, (_, i) => {
    const start = (i * 104729) % 200000
    return [start, start + 1]
  }),
  randomRequests(200000, 1000000000, 100000),
].map(makeCase))
