// 题型参考：洛谷 P1115，题面、范围和评测数据独立编写。
export const question = {
  id: 'max-subarray',
  title: '补给窗口 · 最大连续总和',
  category: '基础算法 / 线性动态规划',
  content: String.raw`## 题目描述

前哨站依次记录了 $n$ 次补给变化。正数表示收到补给，负数表示消耗补给，零表示数量不变。

你需要选择一段连续的记录，使这一段的补给变化总和尽可能大。必须至少选择一条记录，即使所有记录都是负数也不能选择空段。

## 输入格式

第一行一个整数 $n$。接下来给出 $n$ 个整数 $a_1, a_2, \ldots, a_n$，各数以空白分隔。

## 输出格式

输出一个整数，表示所选连续记录的最大总和。

## 输入样例

~~~text
8
-2 3 -1 4 -6 2 2 -1
~~~

## 输出样例

~~~text
6
~~~

选择第 $2$ 至第 $4$ 条记录，总和为 $3-1+4=6$。

## 数据范围

$1 \le n \le 200000$，$-10^6 \le a_i \le 10^6$。答案可能超出 32 位有符号整数范围，请选择合适的数值类型。`,
  timeLimitMs: 2000,
  memoryLimitBytes: 268435456,
  templates: {
    cpp: '#include <cstdio>\nint main() {\n  int n; long long x, s = 0, b = -1000000;\n  scanf("%d", &n);\n  while (n--) { scanf("%lld", &x); s = x + (s > 0 ? s : 0); if (s > b) b = s; }\n  printf("%lld\\n", b);\n}\n',
    c: '#include <stdio.h>\nint main(void) {\n  int n; long long x, s = 0, b = -1000000;\n  scanf("%d", &n);\n  while (n--) { scanf("%lld", &x); s = x + (s > 0 ? s : 0); if (s > b) b = s; }\n  printf("%lld\\n", b);\n  return 0;\n}\n',
    python:
      'import sys\na = iter(map(int, sys.stdin.buffer.read().split()))\nn = next(a)\ns, b = 0, -1000000\nfor x in a:\n  s = x + max(s, 0)\n  b = max(b, s)\nprint(b)\n',
    javascript:
      "const a = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number)\nlet s = 0, b = -1000000\nfor (const x of a.slice(1)) {\n  s = x + Math.max(s, 0)\n  b = Math.max(b, s)\n}\nconsole.log(b)\n",
    typescript:
      "import { readFileSync } from 'fs'\nconst a = readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number)\nlet s = 0, b = -1000000\nfor (const x of a.slice(1)) {\n  s = x + Math.max(s, 0)\n  b = Math.max(b, s)\n}\nconsole.log(b)\n",
    java: 'import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner in = new Scanner(System.in);\n    int n = in.nextInt();\n    long s = 0, b = -1000000;\n    while (n-- > 0) { s = in.nextLong() + Math.max(s, 0); b = Math.max(b, s); }\n    System.out.println(b);\n  }\n}\n',
    go: 'package main\nimport ("bufio"; "fmt"; "os")\nfunc main() {\n  in := bufio.NewReader(os.Stdin)\n  var n int\n  var x, s int64\n  b := int64(-1000000)\n  fmt.Fscan(in, &n)\n  for ; n > 0; n-- {\n    fmt.Fscan(in, &x)\n    if s < 0 { s = 0 }; s += x\n    if s > b { b = s }\n  }\n  fmt.Println(b)\n}\n',
    rust: 'use std::io::{self, Read};\nfn main() {\n  let mut a = String::new();\n  io::stdin().read_to_string(&mut a).unwrap();\n  let mut s = 0i64; let mut b = -1000000i64;\n  for x in a.split_whitespace().skip(1) {\n    s = x.parse::<i64>().unwrap() + s.max(0); b = b.max(s);\n  }\n  println!("{}", b);\n}\n',
    csharp:
      'using System;\nclass MainClass {\n  static void Main() {\n    var a = Console.In.ReadToEnd().Split((char[])null, StringSplitOptions.RemoveEmptyEntries);\n    long s = 0, b = -1000000;\n    for (int i = 1; i < a.Length; i++) { s = long.Parse(a[i]) + Math.Max(s, 0); b = Math.Max(b, s); }\n    Console.WriteLine(b);\n  }\n}\n',
    kotlin:
      'fun main() {\n  val input = java.util.Scanner(System.`in`)\n  val n = input.nextInt()\n  var s = 0L\n  var b = -1000000L\n  repeat(n) { s = input.nextLong() + maxOf(s, 0L); b = maxOf(b, s) }\n  println(b)\n}\n',
    swift:
      'import Foundation\nlet a = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8)!.split { $0.isWhitespace }\nvar s: Int64 = 0, b: Int64 = -1000000\nfor x in a.dropFirst() {\n  s = Int64(x)! + max(s, 0)\n  b = max(b, s)\n}\nprint(b)\n',
    php: '<?php\n$a = preg_split("/\\s+/", trim(stream_get_contents(STDIN)));\n$s = 0; $b = -1000000;\nforeach (array_slice($a, 1) as $x) { $s = intval($x) + max($s, 0); $b = max($b, $s); }\necho $b . PHP_EOL;\n',
    ruby: 'a = STDIN.read.split.map(&:to_i)\ns = 0\nb = -1000000\na.drop(1).each do |x|\n  s = x + [s, 0].max\n  b = [b, s].max\nend\nputs b\n',
    lua: 'local n = io.read("*n")\nlocal s, b = 0, -1000000\nfor i = 1, n do\n  s = io.read("*n") + math.max(s, 0)\n  b = math.max(b, s)\nend\nprint(b)\n',
    perl: 'use strict;\nuse warnings;\nmy @a = split /\\s+/, join(" ", <STDIN>);\nshift @a;\nmy ($s, $b) = (0, -1000000);\nfor my $x (@a) { $s = $x + ($s > 0 ? $s : 0); $b = $s if $s > $b; }\nprint "$b\\n";\n',
    r: 'a <- scan(file("stdin"), quiet = TRUE)\ns <- 0\nb <- -1000000\nfor (x in a[-1]) {\n  s <- x + max(s, 0)\n  b <- max(b, s)\n}\ncat(format(b, scientific = FALSE, trim = TRUE), "\\n")\n',
    bash: 'read -r n\ns=0 b=-1000000\nwhile read -r -a a; do\n  for x in "${a[@]}"; do\n    ((s < 0)) && s=0\n    ((s += x))\n    ((s > b)) && b=$s\n  done\ndone\nprintf "%s\\n" "$b"\n',
  },
}

// 数据仅存在于服务端。前缀最小值法生成答案，与模板的 Kadane 转移独立。
function makeCase(values) {
  let prefix = 0
  let minimum = 0
  let best = -Infinity
  for (const value of values) {
    prefix += value
    best = Math.max(best, prefix - minimum)
    minimum = Math.min(minimum, prefix)
  }
  return { input: values.length + '\n' + values.join(' ') + '\n', answer: String(best) }
}

let seed = 0x1937
function randomValues(length, bound) {
  return Array.from({ length }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return (seed % (2 * bound + 1)) - bound
  })
}

export const cases = [
  [-2, 3, -1, 4, -6, 2, 2, -1],
  [-1000000],
  [1000000],
  [0],
  [-8, -2, -9, -3],
  [0, -1, 0, -2, 0],
  [7, -100, 3, 4, 5],
  [5, 4, -20, 3, 2],
  [-10, 3, -1, 4, -10],
  [5, -1, 5, -1, 5],
  [-100, 10, -20, 30, -40, 50, -100],
  Array(200000).fill(1000000),
  Array(200000).fill(-1000000),
  Array.from({ length: 200000 }, (_, i) => (i % 2 ? -999999 : 1000000)),
  [1000000, ...Array(19998).fill(-1), 1000000],
  ...Array.from({ length: 12 }, (_, i) => randomValues(i * 7 + 2, 17)),
  randomValues(200000, 1000000),
].map(makeCase)
