import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluate } from '../server/judge.js'
import solutions from '../server/questions/max-rise-solutions.js'
import { questions } from '../server/questions/index.js'
import { languages } from '../shared/languages.js'

const integration = { skip: !process.env.JUDGE_INTEGRATION, timeout: 180_000 }
const question = questions['max-rise']
const { cases } = question
const submit = (language, source, indicators = []) => evaluate({ language, source, indicators, question })

for (const language of languages) {
  test(`${language.name} 参考解通过全部边界数据与所选指标`, integration, async () => {
    const result = await submit(language.id, solutions[language.id], ['source-1'])
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
  const result = await evaluate({
    language: 'python',
    source: 'x = 8 // 3\nx //= 2',
    indicators: ['ancient-3', 'arithmetic-1'],
    question,
    mode: 'sample',
  })
  const check = result.checks.find(({ id }) => id === 'arithmetic-1')
  assert.equal(check.status, 'failed')
  assert.deepEqual(check.messages.toSorted(), [
    '第 1 行：不允许使用运算符 //',
    '第 2 行：不允许使用运算符 //=',
  ])
})

test('Java 内部类和辅助类一同打包运行', integration, async () => {
  const source = solutions.java
    .replace(
      'public class Main {',
      'public class Main { static class Run { static int next(int n) { return n + 1; } }',
    )
    .replace('length + 1', 'Run.next(length)')
  const result = await submit('java', source)
  assert.equal(result.verdict, 'AC', result.message)
})

test('原生语言遵守 4 MB 内存档，运行时超限返回 MLE', integration, async () => {
  for (const language of ['c', 'cpp', 'rust']) {
    const result = await submit(language, solutions[language], ['ancient-3', 'memory-2'])
    assert.equal(result.verdict, 'AC', JSON.stringify(result))
    assert.equal(result.passed, true)
  }
  const result = await submit('python', 'data = bytearray(128 * 1024 * 1024)\nprint(len(data))', [
    'ancient-3',
    'memory-2',
  ])
  assert.equal(result.verdict, 'MLE', JSON.stringify(result))
  assert.equal(result.checks.find((check) => check.id === 'memory-2').status, 'failed')
})

test('C++ 相同源码在 325.325 kB 与 4 MB 档使用一致的运行条件', integration, async () => {
  for (let round = 0; round < 3; round++) {
    const strict = await submit('cpp', solutions.cpp, ['ancient-3', 'memory-3'])
    const relaxed = await submit('cpp', solutions.cpp, ['ancient-3', 'memory-2'])
    assert.equal(strict.verdict, 'MLE', JSON.stringify(strict))
    assert.equal(relaxed.verdict, 'AC', JSON.stringify(relaxed))
    assert.equal(relaxed.cases.length, cases.length)
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
    const result = await submit(language, source)
    assert.equal(result.verdict, verdict, JSON.stringify(result))
    assert.equal(result.passed, false)
  }
})

test('C 保留命名、控制流、运算指标检查，宏展开中的运算也参与', integration, async () => {
  const source = solutions.c
    .replace('#include <stdio.h>', '#include <stdio.h>\n#define ADD(a, b) ((a) + (b))')
    .replace('length + 1', 'ADD(length, 1)')
  const result = await submit('c', source, ['ancient-3', 'shrink-3', 'linear-3', 'arithmetic-1'])
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
    const result = await evaluate({ language, source, indicators: [], question, mode: 'sample' })
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
  const result = await submit('cpp', source)
  assert.equal(result.verdict, 'TLE', JSON.stringify(result))
  assert.equal(result.passed, false)
})
