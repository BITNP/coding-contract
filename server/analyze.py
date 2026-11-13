"""提取源码事实。"""

import ast
import io
import json
import sys
import tokenize
from ctypes import c_int
from pathlib import Path


def analyze_python(source):
  tree = ast.parse(source)
  facts = {'names': [], 'syntax': [], 'operators': []}
  operators = {
    'Add': '+', 'Sub': '-', 'Mult': '*', 'Div': '/', 'Mod': '%',
    'FloorDiv': '//', 'Pow': '**', 'MatMult': '@', 'BitAnd': '&',
    'BitOr': '|', 'BitXor': '^', 'LShift': '<<', 'RShift': '>>',
    'Invert': '~', 'UAdd': '+', 'USub': '-', 'Not': 'not'
  }

  def add_name(name, kind, node):
    facts['names'].append({'name': name, 'kind': kind, 'line': node.lineno})

  for node in ast.walk(tree):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
      add_name(node.name, 'function', node)
    elif isinstance(node, ast.arg):
      add_name(node.arg, 'parameter', node)
    elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
      add_name(node.id, 'variable', node)
    elif isinstance(node, ast.alias):
      add_name(node.asname or node.name.split('.')[0], 'variable', node)
    elif isinstance(node, (ast.ExceptHandler, ast.MatchAs, ast.MatchStar)) and node.name:
      add_name(node.name, 'variable', node)
    elif isinstance(node, ast.MatchMapping) and node.rest:
      add_name(node.rest, 'variable', node)

    kind = {'For': 'for', 'AsyncFor': 'for', 'While': 'while', 'If': 'if', 'IfExp': 'conditional'}.get(type(node).__name__)
    if kind:
      facts['syntax'].append({'kind': kind, 'line': node.lineno})
    if isinstance(node, ast.comprehension):
      facts['syntax'].append({'kind': 'for', 'line': node.target.lineno})
      facts['syntax'].extend({'kind': 'if', 'line': condition.lineno} for condition in node.ifs)
    if isinstance(node, ast.match_case) and node.guard:
      facts['syntax'].append({'kind': 'if', 'line': node.guard.lineno})

    if isinstance(node, (ast.BinOp, ast.AugAssign, ast.UnaryOp)):
      operator = operators.get(type(node.op).__name__)
      if operator:
        facts['operators'].append({
          'operator': operator + ('=' if isinstance(node, ast.AugAssign) else ''),
          'arity': 'unary' if isinstance(node, ast.UnaryOp) else 'binary',
          'line': node.lineno
        })

  ignored = {tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT, tokenize.ENDMARKER}
  lines = set()
  physical_lines = source.splitlines()
  for token in tokenize.generate_tokens(io.StringIO(source).readline):
    if token.type not in ignored:
      lines.update(line for line in range(token.start[0], token.end[0] + 1) if physical_lines[line - 1].strip())
  facts['codeLines'] = len(lines)
  return facts


def analyze_clang(filename, source, language):
  from clang.cindex import Cursor, Index, TokenKind, conf

  standard = 'c17' if language == 'c' else 'c++17'
  unit = Index.create().parse(filename, args=[f'-std={standard}', '--gcc-toolchain=/usr'])
  errors = [str(item) for item in unit.diagnostics if item.severity >= item.Error]
  if errors:
    return {'error': '\n'.join(errors)}

  # libclang 提供操作符枚举，可识别宏展开后的运算。
  unary_kind = conf.lib.clang_getCursorUnaryOperatorKind
  unary_kind.argtypes = [Cursor]
  unary_kind.restype = c_int
  binary = {
    'Mul': '*', 'Div': '/', 'Rem': '%', 'Add': '+', 'Sub': '-',
    'Shl': '<<', 'Shr': '>>', 'And': '&', 'Xor': '^', 'Or': '|',
    'MulAssign': '*=', 'DivAssign': '/=', 'RemAssign': '%=',
    'AddAssign': '+=', 'SubAssign': '-=', 'ShlAssign': '<<=',
    'ShrAssign': '>>=', 'AndAssign': '&=', 'XorAssign': '^=', 'OrAssign': '|='
  }
  unary = {1: '++', 2: '--', 3: '++', 4: '--', 5: '&', 6: '*', 7: '+', 8: '-', 9: '~'}
  declarations = {'VAR_DECL': 'variable', 'FIELD_DECL': 'variable', 'PARM_DECL': 'parameter', 'FUNCTION_DECL': 'function', 'CXX_METHOD': 'function', 'FUNCTION_TEMPLATE': 'function'}
  syntax = {'FOR_STMT': 'for', 'CXX_FOR_RANGE_STMT': 'for', 'WHILE_STMT': 'while', 'DO_STMT': 'do', 'IF_STMT': 'if', 'CONDITIONAL_OPERATOR': 'conditional'}
  facts = {'names': [], 'syntax': [], 'operators': []}

  def visit(node):
    # 包括主文件中的宏展开；跳过系统头文件的声明和函数实现。
    if node.location.file and Path(node.location.file.name).resolve() != Path(filename).resolve():
      return
    kind = node.kind.name
    line = node.location.line
    if kind in declarations and node.spelling and not (kind == 'FUNCTION_DECL' and node.spelling == 'main'):
      facts['names'].append({'name': node.spelling, 'kind': declarations[kind], 'line': line})
    if kind in syntax:
      facts['syntax'].append({'kind': syntax[kind], 'line': line})
    operator = None
    arity = 'binary'
    if kind in {'BINARY_OPERATOR', 'COMPOUND_ASSIGNMENT_OPERATOR'}:
      operator = binary.get(node.binary_operator.name)
    elif kind == 'UNARY_OPERATOR':
      operator = unary.get(unary_kind(node))
      arity = 'unary'
    elif kind == 'CALL_EXPR' and node.spelling.startswith('operator'):
      # TODO: 流插入/提取属于重载函数调用，是否保留？
      operator = node.spelling.removeprefix('operator')
      if operator in {'<<', '>>'}:
        operator = None
      elif operator in {'++', '--', '~'}:
        arity = 'unary'
      else:
        arity = 'unary' if len(list(node.get_arguments())) == 1 else 'binary'
    if operator:
      facts['operators'].append({'operator': operator, 'arity': arity, 'line': line})
    for child in node.get_children():
      visit(child)

  visit(unit.cursor)
  lines = set()
  physical_lines = source.splitlines()
  for token in unit.get_tokens(extent=unit.cursor.extent):
    if token.kind != TokenKind.COMMENT:
      lines.update(line for line in range(token.extent.start.line, token.extent.end.line + 1) if line <= len(physical_lines) and physical_lines[line - 1].strip())
  facts['codeLines'] = len(lines)
  return facts


def analyze_lexical(source, language):
  from pygments.lexers import get_lexer_by_name
  from pygments.token import Comment

  # 词法器只负责注释部分，语法是否合法交给各语言的编译器/运行时。
  lexer = get_lexer_by_name(language, stripnl=False, ensurenl=False)
  code = ''.join(
    ''.join('\n' if char == '\n' else ' ' for char in value)
    if kind in Comment and kind not in Comment.Preproc else value
    for _, kind, value in lexer.get_tokens_unprocessed(source)
  )
  return {'codeLines': sum(bool(line.strip()) for line in code.splitlines())}


if __name__ == '__main__':
  language, filename = sys.argv[1:]
  source = Path(filename).read_bytes().decode('utf-8')
  try:
    if language in {'c', 'cpp'}:
      facts = analyze_clang(filename, source, language)
    elif language == 'python':
      facts = analyze_python(source)
    else:
      facts = analyze_lexical(source, language)
  except SyntaxError as error:
    facts = {'error': f'第 {error.lineno} 行：{error.msg}'}
  facts['bytes'] = len(source.encode('utf-8'))
  print(json.dumps(facts, ensure_ascii=False))
