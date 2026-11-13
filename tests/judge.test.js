import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluate } from '../server/judge.js'
import { question, cases } from '../server/question.js'
import { languages } from '../shared/languages.js'

const integration = { skip: !process.env.JUDGE_INTEGRATION, timeout: 180_000 }
const submit = (language, source, indicators = []) => evaluate({ language, source, indicators })

for (const language of languages) {
  test(`${language.name} 模板通过全部边界数据并计分`, integration, async () => {
    const result = await submit(language.id, question.templates[language.id], ['source-1'])
    assert.equal(result.verdict, 'AC', JSON.stringify(result))
    assert.equal(result.cases.length, cases.length)
    assert.equal(result.passed, true)
    assert.equal(result.score, 1)
    assert.ok(Number.isFinite(result.timeMs))
    assert.ok(result.codeLines > 0)
  })
}

test('Java 内部类和辅助类一同打包运行', integration, async () => {
  const source = `import java.util.Scanner;
public class Main {
  static class Adder { long sum(long a, long b) { return a + Math.max(b, 0); } }
  public static void main(String[] args) {
    Scanner in = new Scanner(System.in);
    int n = in.nextInt();
    long s = 0, b = -1000000;
    while (n-- > 0) { s = new Adder().sum(in.nextLong(), s); b = Math.max(b, s); }
    System.out.println(b);
  }
}`
  const result = await submit('java', source)
  assert.equal(result.verdict, 'AC', result.message)
})

test('原生语言遵守 4 MiB 内存档，运行时超限返回 MLE', integration, async () => {
  for (const language of ['c', 'cpp', 'rust']) {
    const result = await submit(language, question.templates[language], ['ancient-3', 'memory-3'])
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
    assert.equal(result.score, 0)
  }
})

test('C 保留命名、控制流、运算指标检查，宏展开中的运算也参与', integration, async () => {
  const source = question.templates.c
    .replace('#include <stdio.h>', '#include <stdio.h>\n#define ADD(a, b) ((a) + (b))')
    .replace('x + (s > 0 ? s : 0)', 'ADD(x, (s > 0 ? s : 0))')
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
    const result = await evaluate({ language, source, indicators: [], mode: 'validate' })
    assert.equal(result.codeLines, codeLines, language)
    assert.equal(result.cases.length, 0)
  }
})

test('样例只运行一组，自动校验不编译运行，运行内存保持待验证', integration, async () => {
  const sample = await evaluate({
    language: 'python',
    source: question.templates.python,
    indicators: [],
    mode: 'sample',
  })
  assert.equal(sample.cases.length, 1)
  const result = await evaluate({
    language: 'javascript',
    source: 'while (true) {}',
    indicators: ['ancient-3', 'memory-1'],
    mode: 'validate',
  })
  assert.equal(result.verdict, 'CHECKED')
  assert.equal(result.cases.length, 0)
  assert.equal(result.checks.find((check) => check.id === 'memory-1').status, 'pending')
})

test('最大规模拒绝 C++ 优化编译后的平方区间枚举', integration, async () => {
  const source =
    '#include <cstdio>\nlong long a[200000];\nint main() {\n  int n; scanf("%d", &n);\n  for (int i = 0; i < n; i++) scanf("%lld", &a[i]);\n  long long b = -1000000;\n  for (int i = 0; i < n; i++) {\n    long long s = 0;\n    for (int j = i; j < n; j++) { s += a[j]; if (s > b) b = s; }\n  }\n  printf("%lld", b);\n}\n'
  const result = await submit('cpp', source)
  assert.equal(result.verdict, 'TLE', JSON.stringify(result))
  assert.equal(result.passed, false)
})
