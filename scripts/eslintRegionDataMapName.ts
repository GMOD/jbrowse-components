// Loaded by `eslint.config.mjs` through a plain `import` of the `.ts` path,
// which node strips types from without a flag. Every CI job that lints runs
// node 24 — the lone node 18 job smoke-tests the packed CLI and never reads
// this config — and `scripts/*.test.ts` already imports its subject by `.ts`
// extension (`caseCollisions.ts` is the same shape). A `.js` module here would
// have needed a hand-written `.d.ts` beside it for the test to import it
// without `any`, which is the restatement this rule exists to object to.
//
// Why the rule exists: `regionDataMap(name)` prints `name` when a display
// stores a non-payload, and at all thirteen call sites `name` is the volatile
// field the map is assigned to — a restatement of a fact one line away. Making
// the parameter required closed the anonymous message and opened a worse one:
// nobody forgets a required argument, but a copy-pasted `'rpcDataMap'` on a
// field called `summaryDataMap` is a violation report that confidently names
// the wrong map.
//
// Why it is a rule and not a selector: the check compares two AST nodes, and
// esquery has no back-reference, so `no-restricted-syntax` cannot express it.
// oxlint has no custom-rule surface at all.
import type { Rule, SourceCode } from 'eslint'

// The listener's own parameter type, so the AST shapes come from eslint
// rather than a second spelling of them here. Never a `Program`, so its
// `parent` is a node rather than `Rule.Node | null`.
type CallNode = Parameters<NonNullable<Rule.RuleListener['CallExpression']>>[0]

// Resolves the callee to its import, so an aliased
// `import { regionDataMap as perRegionMap }` is still checked and an unrelated
// local function of the same name is not. Matches on the imported name alone
// rather than also on the module specifier: the specifier is spelled two ways
// in tree (the package entry and a relative path), and of the two ways to be
// wrong, a false positive is loud and a false negative is silent.
//
// A call inside the module that DECLARES `regionDataMap` resolves to a function
// definition rather than an import and is left alone. There are none, and one
// would be a mistake made in front of the definition.
//
// Takes the call rather than the callee because a callee resolves in the scope
// its call sits in, and the call is the node with a `parent` chain to walk.
function importedNameOf(sourceCode: SourceCode, node: CallNode, name: string) {
  let scope = sourceCode.getScope(node)
  let variable = scope.variables.find(v => v.name === name)
  while (variable === undefined && scope.upper !== null) {
    scope = scope.upper
    variable = scope.variables.find(v => v.name === name)
  }
  const def = variable?.defs[0]
  return def?.type === 'ImportBinding' &&
    def.node.type === 'ImportSpecifier' &&
    def.node.imported.type === 'Identifier'
    ? def.node.imported.name
    : undefined
}

// Only where the call is the value of a statically-named property, which is
// every real one. A local `const` in a test names itself.
function fieldNameOf(node: CallNode) {
  const { parent } = node
  return parent.type === 'Property' &&
    parent.value === node &&
    !parent.computed &&
    parent.key.type === 'Identifier'
    ? parent.key.name
    : undefined
}

export const regionDataMapNamesItsField: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    schema: [],
    messages: {
      mismatch:
        'regionDataMap names the field it is stored on, which is `{{key}}`, not `{{name}}`. That name is what a contract violation prints, so a stale one reports the wrong map.',
      notLiteral:
        "regionDataMap takes the literal name of the field it is stored on — '{{key}}' — so a contract violation can print it.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === 'Identifier') {
          const key = fieldNameOf(node)
          const imported = importedNameOf(
            context.sourceCode,
            node,
            node.callee.name,
          )
          if (key !== undefined && imported === 'regionDataMap') {
            const [name] = node.arguments
            if (name?.type !== 'Literal' || typeof name.value !== 'string') {
              context.report({ node, messageId: 'notLiteral', data: { key } })
            } else if (name.value !== key) {
              context.report({
                node: name,
                messageId: 'mismatch',
                data: { key, name: name.value },
                fix: fixer => fixer.replaceText(name, `'${key}'`),
              })
            }
          }
        }
      },
    }
  },
}

export default {
  rules: { 'region-data-map-names-its-field': regionDataMapNamesItsField },
}
