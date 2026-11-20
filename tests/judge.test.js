import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluate } from '../server/judge.js'
import solutions from '../server/questions/max-rise-solutions.js'
import { questions } from '../server/questions/index.js'
import { languages } from '../shared/languages.js'

const integration = { skip: !process.env.JUDGE_INTEGRATION, timeout: 180_000 }
const question = questions['max-rise']
const { cases } = question
const judge = (language, source, indicators = [], mode) =>
  evaluate({ language, source, indicators, question, mode })

for (const language of languages) {
  test(`${language.name} 参考解通过全部边界数据与所选指标`, integration, async () => {
    const indicators = language.tinyMemory ? ['source-1', 'ancient-3', 'memory-2'] : ['source-1']
    const result = await judge(language.id, solutions[language.id], indicators)
    assert.equal(result.verdict, 'AC', JSON.stringify(result))
    assert.equal(result.cases.length, cases.length)
    assert.equal(result.passed, true)
    assert.ok(Number.isFinite(result.timeMs))
    assert.ok(result.codeLines > 0)
  })
}

const otherSolutions = {
  maze: `from collections import deque
height, width = map(int, input().split())
grid = [input() for _ in range(height)]
start = next((y, row.index('S')) for y, row in enumerate(grid) if 'S' in row)
queue = deque([(*start, 0)])
seen = {start}
while queue:
  y, x, steps = queue.popleft()
  if grid[y][x] == 'E':
    print(steps)
    break
  for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
    if 0 <= ny < height and 0 <= nx < width and grid[ny][nx] != '#' and (ny, nx) not in seen:
      seen.add((ny, nx))
      queue.append((ny, nx, steps + 1))
else:
  print(-1)`,
  'channel-schedule': `import sys
read = sys.stdin.buffer.readline
requests = [tuple(map(int, read().split())) for _ in range(int(read()))]
available = count = 0
for start, end in sorted(requests, key=lambda request: request[1]):
  if start >= available:
    count += 1
    available = end
print(count)`,
}

for (const [id, source] of Object.entries(otherSolutions)) {
  test(`${questions[id].title}参考解通过所有正式数据`, integration, async () => {
    const question = questions[id]
    const result = await evaluate({ question, source, language: 'python', indicators: [] })
    assert.equal(result.verdict, 'AC', result.message)
    assert.equal(result.cases.length, question.cases.length)
  })
}

test('样例保留运行诊断，正式提交只返回组号和判定', async (t) => {
  const analysis = { status: 'Accepted', files: { stdout: '{"bytes":8,"codeLines":1}' } }
  const failure = {
    status: 'Nonzero Exit Status',
    files: { stderr: 'sample diagnostic' },
    error: 'sandbox diagnostic',
    time: 0,
    memory: 0,
  }
  t.mock.method(globalThis, 'fetch', async (_url, { body }) => {
    const [cmd] = JSON.parse(body).cmd
    return Response.json([cmd.args.includes('analyze.py') ? analysis : failure])
  })
  const submission = { language: 'python', source: 'print(0)', indicators: [], question }
  assert.equal((await evaluate({ ...submission, mode: 'sample' })).message, 'sample diagnostic')
  assert.equal((await evaluate(submission)).message, '第 1 组数据：RE')
})

test('低等数学 I 检查 Python 整除及其复合赋值', integration, async () => {
  const result = await judge('python', 'x = 8 // 3\nx //= 2', ['ancient-3', 'arithmetic-1'], 'sample')
  const check = result.checks.find(({ id }) => id === 'arithmetic-1')
  assert.equal(check.status, 'failed')
  assert.deepEqual(check.messages.toSorted(), [
    '第 1 行：不允许使用运算符 //',
    '第 2 行：不允许使用运算符 //=',
  ])
})

test('Java 内部类和辅助类一同打包运行', integration, async () => {
  const source = `public class Main {
  static class Answer extends Helper {}
  public static void main(String[] args) { System.out.println(new Answer().value()); }
}
class Helper { int value() { return ${cases[0].answer}; } }`
  const result = await judge('java', source, [], 'sample')
  assert.equal(result.verdict, 'AC', result.message)
})

test('同一 C++ 程序写入 1 MiB 后，在 325.325 kB 档超限、4 MB 档通过', integration, async () => {
  const source = `#include <cstdio>
volatile char buffer[1024 * 1024];
int main() {
  for (auto &byte : buffer) byte = 1;
  std::puts("${cases[0].answer}");
}`
  for (const [id, verdict] of [
    ['memory-3', 'MLE'],
    ['memory-2', 'AC'],
  ]) {
    const result = await judge('cpp', source, ['ancient-3', id], 'sample')
    assert.equal(result.verdict, verdict, JSON.stringify(result))
  }
})

test('编译错误、类型错误、答案错误、运行错误、超时和输出超限分别返回', integration, async () => {
  const samples = [
    ['c', 'int main( {', 'CE'],
    ['java', 'public class Main { broken }', 'CE'],
    ['typescript', 'const value: number = "text"', 'CE'],
    ['javascript', 'console.log(0)', 'WA'],
    ['python', 'raise RuntimeError("failure")', 'RE'],
    ['bash', 'while true; do :; done', 'TLE'],
    ['python', 'print("x" * 100000)', 'OLE'],
  ]
  for (const [language, source, verdict] of samples) {
    const result = await judge(language, source)
    assert.equal(result.verdict, verdict, JSON.stringify(result))
    assert.equal(result.passed, false)
  }
})

test('C 保留命名、控制流、运算指标检查，宏展开中的运算也参与', integration, async () => {
  const source = `#include <stdio.h>
#define ADD(a, b) ((a) + (b))
int main(void) {
  int answer = 0;
  if (!answer) answer = ADD(answer, ${cases[0].answer});
  printf("%d", answer);
}`
  const result = await judge('c', source, ['ancient-3', 'shrink-3', 'linear-3', 'arithmetic-1'], 'sample')
  assert.equal(result.verdict, 'AC', result.message)
  assert.equal(result.passed, false)
  for (const id of ['shrink-3', 'linear-3', 'arithmetic-1']) {
    assert.equal(result.checks.find((check) => check.id === id).status, 'failed', id)
  }
})

test('各词法器保留字符串中的注释标记，排除纯注释行', integration, async () => {
  const samples = [
    ['javascript', '// comment\nconsole.log("//")\n/* comment\n comment */\n', 1],
    ['typescript', '/* comment */\nconst text: string = "/* text */"\n', 1],
    ['ruby', '# comment\nputs "# text"\n', 1],
    ['lua', '-- comment\nprint("-- text")\n--[[ block\ncomment ]]\n', 1],
    ['bash', '# comment\nprintf "%s" "# text"\n', 1],
    ['swift', '// comment\nprint("// text")\n', 1],
    ['php', '<?php\n// comment\necho "// text";\n', 2],
  ]
  for (const [language, source, codeLines] of samples) {
    const result = await judge(language, source, [], 'sample')
    assert.equal(result.codeLines, codeLines, language)
  }
})

test('最大规模拒绝重复扫描每个上升段起点的平方解', integration, async () => {
  const source = `#include <cstdio>
int a[200000];
int main() {
  int n, best = 1;
  scanf("%d", &n);
  for (int i = 0; i < n; i++) scanf("%d", &a[i]);
  for (int i = 0; i < n; i++) {
    int j = i + 1;
    while (j < n && a[j] > a[j - 1]) j++;
    if (j - i > best) best = j - i;
  }
  printf("%d", best);
}`
  const result = await judge('cpp', source)
  assert.equal(result.verdict, 'TLE', JSON.stringify(result))
  assert.equal(result.passed, false)
})
