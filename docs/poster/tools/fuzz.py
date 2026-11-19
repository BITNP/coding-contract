#!/usr/bin/env python3
"""对 Typst 模版做变异测试，找出删掉或改掉也不影响渲染结果的代码。

做法：对模版生成四类变异——删一行、删一整个括号块、删一个命名参数、改一个数值，
逐个重新编译示例文档，与基准渲染逐字节比较 PNG。渲染完全不变的变异说明那段代码多余
（或者是被覆盖、被裁切掉的无效装饰），列出来供人工确认后删除。

用法（在 docs/poster 下）：
    python3 tools/fuzz.py                      # 全部四类
    python3 tools/fuzz.py --kinds arg,num      # 只跑部分类型
    python3 tools/fuzz.py --target poster-template.typ --docs contract.typ tools/coverage.typ

只需要 Python 3 标准库和 typst。结果写到 tools/fuzz-report.txt。
"""

import argparse
import hashlib
import os
import queue
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OPEN, CLOSE = "([{", ")]}"


def code_mask(src):
    """标出不在字符串和 // 注释里的字符。"""
    mask = [True] * len(src)
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        if c == '"':
            j = i + 1
            while j < n and src[j] != '"':
                j += 2 if src[j] == "\\" else 1
            for k in range(i, min(j + 1, n)):
                mask[k] = False
            i = j + 1
        elif src.startswith("//", i) and (i == 0 or src[i - 1] != ":"):
            j = src.find("\n", i)
            j = n if j < 0 else j
            for k in range(i, j):
                mask[k] = False
            i = j
        else:
            i += 1
    return mask


def value_end(src, mask, start):
    """从 start 开始读一个参数值，返回它在顶层逗号或右括号前的结束位置。"""
    depth, i = 0, start
    while i < len(src):
        c = src[i]
        if mask[i]:
            if c in OPEN:
                depth += 1
            elif c in CLOSE:
                if depth == 0:
                    break
                depth -= 1
            elif c == "," and depth == 0:
                break
        i += 1
    while i > start and src[i - 1] in " \n\t":
        i -= 1
    return i


def line_of(src, pos):
    return src.count("\n", 0, pos) + 1


def mutants(src, kinds):
    mask = code_mask(src)
    lines = src.split("\n")
    offsets = [0]
    for line in lines:
        offsets.append(offsets[-1] + len(line) + 1)

    def code_only(i):
        return "".join(ch for k, ch in enumerate(lines[i]) if mask[offsets[i] + k])

    def skip(i):
        stripped = lines[i].strip()
        return not stripped or stripped.startswith("//")

    if "line" in kinds:
        for i in range(len(lines)):
            if skip(i):
                continue
            yield ("line", i + 1, lines[i].strip(), "\n".join(lines[:i] + lines[i + 1 :]))

    if "block" in kinds:
        for i in range(len(lines)):
            if skip(i):
                continue
            balance = sum((c in OPEN) - (c in CLOSE) for c in code_only(i))
            if balance <= 0:
                continue
            j = i
            while balance > 0 and j + 1 < len(lines):
                j += 1
                balance += sum((c in OPEN) - (c in CLOSE) for c in code_only(j))
            if balance == 0 and j > i:
                yield ("block", i + 1, f"{lines[i].strip()} …（至第 {j + 1} 行）", "\n".join(lines[:i] + lines[j + 1 :]))

    if "arg" in kinds:
        for m in re.finditer(r"([a-z][a-z0-9-]*)\s*:\s", src):
            s = m.start()
            if not mask[s]:
                continue
            k = s - 1
            while k >= 0 and src[k] in " \t\n":
                k -= 1
            if k < 0 or src[k] not in "(,":
                continue
            e = value_end(src, mask, m.end())
            tail = e
            while tail < len(src) and src[tail] in " \t":
                tail += 1
            if tail < len(src) and src[tail] == ",":
                tail += 1
                while tail < len(src) and src[tail] in " \t\n":
                    tail += 1
                new = src[:s] + src[tail:]
            else:
                new = src[: k if src[k] == "," else s] + src[e:]
            yield ("arg", line_of(src, s), src[s:e].replace("\n", " ")[:90], new)

    if "num" in kinds:
        for m in re.finditer(r"(?<![\w.#-])(\d+(?:\.\d+)?)(pt|em|%|deg)?(?![\w.])", src):
            if not mask[m.start()]:
                continue
            raw, unit = m.group(1), m.group(2) or ""
            if unit or "." in raw:
                v = float(raw)
                new_val = f"{(v * 1.5 if v else 1):g}{unit}"
            else:
                new_val = str(int(raw) + 1)
            new = src[: m.start()] + new_val + src[m.end() :]
            context = lines[line_of(src, m.start()) - 1].strip()[:70]
            yield ("num", line_of(src, m.start()), f"{m.group(0)} → {new_val}　｜ {context}", new)


def render(workdir, docs, ppi):
    digests = []
    for doc in docs:
        out = os.path.join(workdir, "_out.png")
        r = subprocess.run(
            ["typst", "compile", "--root", workdir, os.path.join(workdir, doc), out, "--ppi", str(ppi)],
            capture_output=True,
        )
        if r.returncode != 0:
            return None
        with open(out, "rb") as f:
            digests.append(hashlib.sha256(f.read()).hexdigest())
    return digests


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--target", default="poster-template.typ")
    ap.add_argument("--docs", nargs="+", default=["contract.typ", "tools/coverage.typ"])
    ap.add_argument("--kinds", default="line,block,arg,num")
    ap.add_argument("--ppi", type=int, default=96)
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--report", default=os.path.join(HERE, "fuzz-report.txt"))
    args = ap.parse_args()

    with open(os.path.join(ROOT, args.target), encoding="utf-8") as f:
        src = f.read()
    cases = list(mutants(src, set(args.kinds.split(","))))

    tmp = tempfile.mkdtemp(prefix="typst-fuzz-")
    ignore = shutil.ignore_patterns("*.png", "*.pdf", "fuzz-report.txt")
    pool = queue.Queue()
    for w in range(args.jobs):
        d = os.path.join(tmp, f"w{w}")
        shutil.copytree(ROOT, d, ignore=ignore)
        for name in ("glow", "rim", "metal"):  # 刊头素材是 PNG，需要单独拷回
            shutil.copy(os.path.join(ROOT, "assets", f"emblem-{name}.png"), os.path.join(d, "assets"))
        pool.put(d)

    base_dir = pool.get()
    baseline = render(base_dir, args.docs, args.ppi)
    pool.put(base_dir)
    if baseline is None:
        sys.exit("基准渲染失败，先确认未修改的模版能正常编译。")

    def run(case):
        kind, line, desc, text = case
        d = pool.get()
        try:
            with open(os.path.join(d, args.target), "w", encoding="utf-8") as f:
                f.write(text)
            got = render(d, args.docs, args.ppi)
        finally:
            pool.put(d)
        status = "error" if got is None else ("same" if got == baseline else "diff")
        return kind, line, desc, status

    done = 0
    results = []
    with ThreadPoolExecutor(args.jobs) as ex:
        for res in ex.map(run, cases):
            results.append(res)
            done += 1
            if done % 50 == 0 or done == len(cases):
                print(f"\r{done}/{len(cases)}", end="", file=sys.stderr, flush=True)
    print(file=sys.stderr)
    shutil.rmtree(tmp, ignore_errors=True)

    same = [r for r in results if r[3] == "same"]
    with open(args.report, "w", encoding="utf-8") as f:
        f.write(f"# {args.target}：{len(cases)} 个变异，{len(same)} 个不影响渲染\n")
        f.write(f"# 文档：{' '.join(args.docs)}　ppi={args.ppi}\n\n")
        for kind, line, desc, _ in sorted(same, key=lambda r: (r[1], r[0])):
            f.write(f"{line:>4}  {kind:<5}  {desc}\n")
    counts = {s: sum(r[3] == s for r in results) for s in ("same", "diff", "error")}
    print(f"共 {len(cases)} 个变异：不变 {counts['same']}，有变化 {counts['diff']}，编译失败 {counts['error']}")
    print(f"报告：{args.report}")


if __name__ == "__main__":
    main()
