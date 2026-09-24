import * as ts from 'typescript'

import {
  jsDocText,
  markdownTable,
  parseSourceFileSyntactic,
  proseCell,
  rewriteMarkerBlock,
} from './util.ts'

// The mark display's rule list, as the mark display guide lists it: every
// entry of `MARK_RULES`, its level, and the JSDoc on the entry, which is the
// sentence a reader gets. A rule with no JSDoc fails the run, since a blank
// cell reads as a rule that reports nothing.
//
//   <!-- MARK_RULES START -->
//   <!-- MARK_RULES END -->

const RULES_SOURCE = 'plugins/marks/src/LinearMarkDisplay/markProblems.ts'

interface Rule {
  id: string
  level: string
  summary: string
}

function objectLiteralOf(node: ts.Expression): ts.ObjectLiteralExpression {
  if (ts.isObjectLiteralExpression(node)) {
    return node
  }
  if (ts.isSatisfiesExpression(node) || ts.isAsExpression(node)) {
    return objectLiteralOf(node.expression)
  }
  throw new Error(`${RULES_SOURCE}: MARK_RULES is not an object literal`)
}

function collectRules(): Rule[] {
  const rules: Rule[] = []
  parseSourceFileSyntactic(RULES_SOURCE).forEachChild(node => {
    if (!ts.isVariableStatement(node)) {
      return
    }
    for (const d of node.declarationList.declarations) {
      if (
        !ts.isIdentifier(d.name) ||
        d.name.text !== 'MARK_RULES' ||
        !d.initializer
      ) {
        continue
      }
      for (const p of objectLiteralOf(d.initializer).properties) {
        if (
          !ts.isPropertyAssignment(p) ||
          !ts.isStringLiteral(p.name) ||
          !ts.isStringLiteralLike(p.initializer)
        ) {
          throw new Error(
            `${RULES_SOURCE}: a MARK_RULES entry is not 'rule-id': 'level'`,
          )
        }
        const summary = jsDocText(p).trim()
        if (!summary) {
          throw new Error(
            `${RULES_SOURCE}: MARK_RULES '${p.name.text}' has no JSDoc; the mark display guide lists each rule by it`,
          )
        }
        rules.push({ id: p.name.text, level: p.initializer.text, summary })
      }
    }
  })
  if (rules.length === 0) {
    throw new Error(`${RULES_SOURCE}: no MARK_RULES found`)
  }
  return rules
}

export function writeMarkRuleDocs({ check = false } = {}) {
  const rules = collectRules()
  const ordered = [
    ...rules.filter(r => r.level === 'error'),
    ...rules.filter(r => r.level !== 'error'),
  ]
  return rewriteMarkerBlock(
    'MARK_RULES',
    markdownTable(
      ['Rule', 'Level', 'Reports'],
      ordered.map(
        r => `| \`${r.id}\` | ${r.level} | ${proseCell(r.summary)} |`,
      ),
    ),
    { check },
  )
}
