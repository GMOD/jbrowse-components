import * as ts from 'typescript'

// The identifier an expression is called or asserted from: `Base`, `Mixin()`,
// `Base!` and `factory(pm)!` all name theirs. `throughMember` also peels the
// property accesses it accepts, so `factory(pm).named('X')` can name `factory`.
export function headIdentifier(
  expr: ts.Expression,
  throughMember: (name: string) => boolean = () => false,
): ts.Identifier | undefined {
  return ts.isIdentifier(expr)
    ? expr
    : ts.isCallExpression(expr) ||
        ts.isNonNullExpression(expr) ||
        (ts.isPropertyAccessExpression(expr) && throughMember(expr.name.text))
      ? headIdentifier(expr.expression, throughMember)
      : undefined
}

// `compose` for `types.compose`: the member of the MST `types` namespace an
// expression names.
export function typesMemberName(expr: ts.Expression) {
  return ts.isPropertyAccessExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === 'types'
    ? expr.name.text
    : undefined
}

export function isTypesCall(
  node: ts.Node,
  name: string,
): node is ts.CallExpression {
  return ts.isCallExpression(node) && typesMemberName(node.expression) === name
}

export function isSchemaCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'ConfigurationSchema'
  )
}

// The name a `ConfigurationSchema('Name', …)` call gives its schema
export function schemaCallName(node: ts.Node) {
  const [name] = isSchemaCall(node) ? node.arguments : []
  return name && ts.isStringLiteralLike(name) ? name.text : undefined
}

// The chain methods that extend a model with members
export const MODEL_CHAIN_METHODS = new Set([
  'props',
  'volatile',
  'views',
  'actions',
])

// The expression a factory returns: an arrow's expression body, or the first
// top-level `return` in a block body (nested returns inside view/action
// callbacks are intentionally ignored).
export function returnedExpression(fn: ts.FunctionLikeDeclaration) {
  const body = fn.body
  return body && !ts.isBlock(body)
    ? body
    : body?.statements.find(ts.isReturnStatement)?.expression
}
