// Lezer 负责解析；这里只把语法节点映射成 shared/checks.js 使用的事实。
const declarators = new Set([
  'Identifier',
  'FieldIdentifier',
  'ScopedIdentifier',
  'InitDeclarator',
  'FunctionDeclarator',
  'PointerDeclarator',
  'ReferenceDeclarator',
  'ArrayDeclarator',
  'ParenthesizedDeclarator',
  'StructuredBindingDeclarator',
  'VariadicDeclarator',
])
const declarations = new Set([
  'Declaration',
  'FieldDeclaration',
  'FunctionDefinition',
  'ForRangeLoop',
  'ParameterDeclaration',
  'OptionalParameterDeclaration',
  'VariadicParameterDeclaration',
])
const targets = new Set(['TupleExpression', 'ArrayExpression', 'ParenthesizedExpression'])
const unary = new Set(['UnaryExpression', 'UpdateExpression'])
const binary = new Set(['BinaryExpression', 'AssignmentExpression', 'UpdateStatement'])
const operators = new Set(['ArithOp', 'BitOp', 'UpdateOp'])
const control = { for: 'for', while: 'while', do: 'do', if: 'if', elif: 'if' }
const operatorAliases = {
  bitand: '&',
  bitor: '|',
  xor: '^',
  compl: '~',
  and_eq: '&=',
  or_eq: '|=',
  xor_eq: '^=',
}

function children(node) {
  const result = []
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child)
  return result
}

export function syntaxFacts(tree, source, language) {
  const facts = { names: [], syntax: [], operators: [] }
  const lineStarts = [0, ...Array.from(source.matchAll(/\n/g), (match) => match.index + 1)]
  const text = (node) => source.slice(node.from, node.to)
  let complete = true

  function lineAt(node) {
    let low = 0
    let high = lineStarts.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (lineStarts[middle] <= node.from) low = middle + 1
      else high = middle
    }
    return low
  }

  function name(node, kind) {
    if (!node || (language !== 'python' && kind === 'function' && text(node) === 'main')) return
    facts.names.push({ name: text(node), kind, line: lineAt(node), from: node.from, to: node.to })
  }

  function cppBinding(node, kind = 'variable') {
    if (node.name === 'Identifier' || node.name === 'FieldIdentifier') return name(node, kind)
    if (node.name === 'StructuredBindingDeclarator') {
      node.getChildren('Identifier').forEach((child) => name(child, kind))
      return
    }
    if (kind !== 'parameter') {
      if (node.name === 'FunctionDeclarator') kind = 'function'
      if (node.name === 'PointerDeclarator' || node.name === 'ReferenceDeclarator') kind = 'variable'
    }
    // 函数指针和返回指针的函数，按最靠近名字的声明节点区分。
    const child =
      node.name === 'ScopedIdentifier'
        ? node.lastChild
        : children(node).find((child) => declarators.has(child.name))
    if (child) cppBinding(child, kind)
  }

  function pythonTarget(node, kind = 'variable') {
    if (node.name === 'VariableName') name(node, kind)
    else if (targets.has(node.name)) children(node).forEach((child) => pythonTarget(child, kind))
  }

  function pythonBindings(node, parts) {
    if (node.name === 'FunctionDefinition') name(node.getChild('VariableName'), 'function')
    if (node.name === 'ParamList') {
      let parameter = true
      for (const part of parts) {
        if (part.name === ',') parameter = true
        else if (part.name === 'VariableName' && parameter) {
          name(part, 'parameter')
          parameter = false
        }
      }
    }
    if (node.name === 'AssignStatement') {
      const end = parts.findLastIndex((part) => part.name === 'AssignOp')
      parts.slice(0, end < 0 ? 1 : end).forEach((part) => pythonTarget(part))
    }
    if (node.name === 'UpdateStatement') pythonTarget(parts[0])
    parts.forEach((part, i) => {
      if (part.name === 'AssignOp' && text(part) === ':=') pythonTarget(parts[i - 1])
    })
    // for 语句、推导式和生成器参数共用同一组 for … in 节点。
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].name !== 'for') continue
      while (++i < parts.length && parts[i].name !== 'in') pythonTarget(parts[i])
    }
    if (['WithStatement', 'TryStatement', 'AsPattern'].includes(node.name)) {
      parts.forEach((part, i) => {
        if (part.name === 'as') pythonTarget(parts[i + 1])
      })
    }
    if (node.name === 'CapturePattern') {
      const binding = node.getChild('VariableName')
      if (text(binding) !== '_') name(binding, 'variable')
    }
    if (node.name === 'ImportStatement') {
      let binding
      let alias = false
      for (const part of parts.slice(parts.findIndex((part) => part.name === 'import') + 1)) {
        if (part.name === ',') {
          name(binding, 'variable')
          binding = undefined
        } else if (part.name === 'as') alias = true
        else if (part.name === 'VariableName' && (!binding || alias)) {
          binding = part
          alias = false
        }
      }
      name(binding, 'variable')
    }
  }

  function isStream(node) {
    if (node.name === 'BinaryExpression') return isStream(node.firstChild)
    if (node.name === 'ParenthesizedExpression') return isStream(node.firstChild.nextSibling)
    return /^(std\s*::\s*)?w?(cin|cout|cerr|clog)$/.test(text(node))
  }

  tree.iterate({
    enter(cursor) {
      const node = cursor.node
      if (node.type.isError) complete = false
      // 宏及头文件的展开语义由提交时的 Clang 复查，不当成普通声明。
      if (node.name === 'PreprocDirective') return false
      const parts = children(node)
      if (language === 'python') pythonBindings(node, parts)
      else if (declarations.has(node.name)) {
        let bindings = parts.filter((part) => declarators.has(part.name))
        if (node.name === 'FieldDeclaration') bindings = bindings.filter((part) => part.name !== 'Identifier')
        if (node.name === 'ForRangeLoop' || node.parent?.name === 'ConditionClause')
          bindings = bindings.slice(0, 1)
        const kind = node.name.includes('ParameterDeclaration') ? 'parameter' : 'variable'
        bindings.forEach((binding) => cppBinding(binding, kind))
      } else if (node.name === 'AssignmentExpression' && node.parent?.name === 'LambdaCaptureSpecifier') {
        cppBinding(node.firstChild)
      }

      let kind = control[node.name]
      if (node.name === 'while' && node.parent.name === 'DoStatement') kind = undefined
      if (node.name === 'if' && node.parent.name === 'ConditionalExpression') kind = 'conditional'
      if (language !== 'python' && node.name === 'ConditionalExpression') kind = 'conditional'
      if (kind) facts.syntax.push({ kind, line: lineAt(node), from: node.from, to: node.to })

      const parent = node.parent
      if (!operators.has(node.name) || (!unary.has(parent.name) && !binary.has(parent.name))) return
      const operator = operatorAliases[text(node)] || text(node)
      // cout/cin 的流插入、提取保留；其参数中的位移仍照常检查。
      if (language === 'cpp' && ['<<', '>>'].includes(operator) && isStream(parent.firstChild)) return
      facts.operators.push({
        operator,
        arity: unary.has(parent.name) ? 'unary' : 'binary',
        line: lineAt(node),
        from: node.from,
        to: node.to,
      })
    },
  })
  // 输入尚未闭合时保留上次完整语法的状态，字节和行数仍独立更新。
  return complete ? facts : {}
}
