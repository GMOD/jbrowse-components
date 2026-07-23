// Resolves the string-array constants that config schemas spread into their
// `types.enumeration(...)` models, e.g.
//
//   types.enumeration('heightMode', [...HEIGHT_MODE_VALUES])
//
// Without this the config-doc generator can't see the members, so it falls back
// to dumping the slot's raw source into the page — which both hides the one fact
// a reader wants (the valid values) and makes the page look like source code.
// Those spreads exist deliberately: the enum, the menu options, and the runtime
// type all derive from one table, so the docs have to follow the same indirection
// rather than ask authors to re-type the values inline.
//
// Three declaration shapes are supported, matching what the schemas actually
// use:
//
//   const A = ['x', 'y'] as const
//   const B = A.map(([value]) => value)                 // tuple table -> values
//   const C = G.flatMap(([, opts]) => opts.map(([v]) => v))  // grouped table
//
// Resolution is by name across the whole repo. A name defined more than once
// with different values is dropped rather than guessed at, so an ambiguous
// constant degrades to today's behavior (source block) instead of documenting
// the wrong list.
import fs from 'fs'

import * as ts from 'typescript'

// name -> members, or null once a conflicting definition is seen
const index = new Map<string, string[] | null>()

function stringsOf(node: ts.Expression): string[] | undefined {
  if (!ts.isArrayLiteralExpression(node)) {
    return undefined
  }
  const values = node.elements.filter(ts.isStringLiteralLike).map(e => e.text)
  return values.length === node.elements.length ? values : undefined
}

// First string literal of each tuple in `[['a', 'A'], ['b', 'B']]`, which is how
// the wiggle/canvas tables pair a config value with its menu label.
function tupleHeads(node: ts.Expression): string[] | undefined {
  if (!ts.isArrayLiteralExpression(node)) {
    return undefined
  }
  const heads = node.elements
    .map(el =>
      ts.isArrayLiteralExpression(el) && el.elements[0] !== undefined
        ? el.elements[0]
        : undefined,
    )
    .map(head => (head && ts.isStringLiteralLike(head) ? head.text : undefined))
    .filter(v => v !== undefined)
  return heads.length === node.elements.length && heads.length
    ? heads
    : undefined
}

// Nested tables: `[['Group', [['a', 'A'], ...]], ...]` -> every inner head.
function groupedTupleHeads(node: ts.Expression): string[] | undefined {
  if (!ts.isArrayLiteralExpression(node)) {
    return undefined
  }
  const groups = node.elements.map(el =>
    ts.isArrayLiteralExpression(el) && el.elements[1] !== undefined
      ? tupleHeads(el.elements[1])
      : undefined,
  )
  return groups.every(g => g !== undefined) && groups.length
    ? groups.flat()
    : undefined
}

// `X.map(...)` / `X.flatMap(...)` -> the name of X, so a derived constant can be
// resolved from the table it projects. The projection itself isn't interpreted:
// every such table in the codebase maps to its tuple heads, and a table that
// didn't would surface as a wrong list, so we only accept the two shapes above.
function projectionSource(node: ts.Expression) {
  return ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    (node.expression.name.text === 'map' ||
      node.expression.name.text === 'flatMap') &&
    ts.isIdentifier(node.expression.expression)
    ? {
        name: node.expression.expression.text,
        grouped: node.expression.name.text === 'flatMap',
      }
    : undefined
}

function record(name: string, values: string[]) {
  const prior = index.get(name)
  if (prior === undefined) {
    index.set(name, values)
  } else if (prior === null || prior.join('\0') !== values.join('\0')) {
    index.set(name, null)
  }
}

/**
 * Scan `files` for top-level string-array constants. Cheap enough to run over
 * the whole repo: only files whose text mentions a candidate declaration are
 * parsed.
 */
export function buildEnumConstantIndex(files: string[]) {
  const literals = new Map<string, ts.Expression>()
  const derived = new Map<string, { name: string; grouped: boolean }>()
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    if (!/\bconst\s+[A-Za-z_$][\w$]*\s*=/.test(text)) {
      continue
    }
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    for (const stmt of sf.statements) {
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          const init = decl.initializer
          if (init && ts.isIdentifier(decl.name)) {
            const name = decl.name.text
            // `as const` wraps the literal in an assertion expression
            const value = ts.isAsExpression(init) ? init.expression : init
            const direct = stringsOf(value)
            if (direct) {
              record(name, direct)
              literals.set(name, value)
            } else if (tupleHeads(value) ?? groupedTupleHeads(value)) {
              literals.set(name, value)
            } else {
              const projection = projectionSource(value)
              if (projection) {
                derived.set(name, projection)
              }
            }
          }
        }
      }
    }
  }
  // second pass: derived constants, now that every table is known
  for (const [name, { name: from, grouped }] of derived) {
    const table = literals.get(from)
    const values = table
      ? grouped
        ? groupedTupleHeads(table)
        : tupleHeads(table)
      : undefined
    if (values) {
      record(name, values)
    }
  }
}

/** Members of a named string-array constant, or undefined if unknown/ambiguous. */
export function enumConstantValues(name: string) {
  return index.get(name) ?? undefined
}
