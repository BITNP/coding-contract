import { defineQuestion, random } from './data.js'

// 题型参考：LeetCode 714，题面、范围和评测数据独立编写。
const question = {
  id: 'fee-trading',
  title: '物资周转',
  category: '动态规划 / 状态机',
  content: String.raw`## 题目描述

后勤处掌握了接下来 $n$ 天某种物资的价格，第 $i$ 天的价格为 $p_i$。你可以在任意一天以当天价格买入一份物资，并在之后的某一天以当天价格卖出。

任意时刻最多持有一份物资，卖出后才能再次买入，交易次数不限。每次卖出需要支付固定手续费 $f$。求最大总利润；不进行任何交易时利润为 $0$。

## 输入格式

第一行两个整数 $n, f$。第二行 $n$ 个整数 $p_1, p_2, \ldots, p_n$，以空白分隔。

## 输出格式

输出一个整数，表示最大总利润。

## 输入样例

~~~text
4 2
1 4 3 6
~~~

## 输出样例

~~~text
3
~~~

第 $1$ 天买入并持有到第 $4$ 天卖出，净利润为 $6-1-2=3$。若分成两笔交易，每笔都要付手续费，合计只赚 $(4-1-2)+(6-3-2)=2$。

## 数据范围

$1 \le n \le 200000$，$0 \le f \le 10^9$，$1 \le p_i \le 10^9$。答案可能超出 32 位有符号整数范围。`,
}

function profit(fee, prices) {
  let cash = 0
  let hold = -Infinity
  for (const price of prices) {
    hold = Math.max(hold, cash - price)
    cash = Math.max(cash, hold + price - fee)
  }
  return cash
}

const makeCase = ([fee, prices]) => ({
  input: `${prices.length} ${fee}\n${prices.join(' ')}\n`,
  answer: String(profit(fee, prices)),
})

const rng = random(0x7f4a)

export default defineQuestion(question, () => [
  [2, [1, 4, 3, 6]],
  [0, [5]],
  [1000000000, [1, 1000000000]],
  [0, [1, 1000000000]],
  [0, [9, 8, 7, 6, 5]],
  [2, [1, 3, 2, 8, 4, 9]],
  [5, [1, 4, 2, 5, 3, 6, 4, 7]],
  [1, [1, 3, 2, 4, 3, 5]],
  [0, [3, 3, 3, 3]],
  [0, Array.from({ length: 200000 }, (_, i) => (i % 2 ? 1000000000 : 1))],
  [999999998, Array.from({ length: 200000 }, (_, i) => (i % 2 ? 1000000000 : 1))],
  [7, Array.from({ length: 200000 }, (_, i) => 1 + i * 5000)],
  [7, Array.from({ length: 200000 }, (_, i) => 1000000000 - i * 5000)],
  ...Array.from({ length: 12 }, (_, i) => [rng.int(0, 4), rng.ints(i * 5 + 2, 1, 12)]),
  [rng.int(0, 1000000), rng.ints(200000, 1, 1000000000)],
  [rng.int(0, 1000), rng.ints(200000, 1, 1000000000)],
].map(makeCase))
