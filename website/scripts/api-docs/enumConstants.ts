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
import * as ts from 'typescript'

// name -> members, or null once a conflicting definition is seen
const index = new Map<string, string[] | null>()

// The same idea for a lone string constant used as a slot's `defaultValue`, e.g.
//
//   defaultValue: DEFAULT_HIC_COLOR_SCHEME
//
// A slot default is written that way for the same reason as the enum spreads
// above — the runtime default and the schema default are one fact — and the
// reader still wants the value, not the identifier. Same conflict rule: a name
// defined twice with different values is dropped, so it degrades to printing the
// identifier rather than documenting the wrong default.
const scalarIndex = new Map<string, string | null>()

// And the same idea one level up: a constant holding a whole *group* of slots,
// spread into a schema's slot table:
//
//   const wiggleConfigSchemaFields = { minScore: { type: 'number', ... }, ... }
//   ConfigurationSchema('LinearWiggleDisplay', { ..., ...wiggleConfigSchemaFields })
//
// Those slots are real slots of every schema that spreads them, but they carry no
// `#slot` JSDoc of their own (they aren't in a `#config` file), so without this
// they were absent from the config pages entirely — 20 wiggle slots, autoscale
// and minScore/maxScore among them, documented nowhere. Same conflict rule as
// above: a name defined twice is dropped rather than guessed at.
//
// name -> ordered `slotName: { ... }` source pairs, or null on a conflict
const slotFieldsIndex = new Map<string, [string, string][] | null>()

// One entry of a slot table's source: either a slot of its own, or another slot
// table it spreads in.
type SlotPart = { pair: [string, string] } | { spread: string }

// Slot-shaped object literal: every property is either `name: { ... }` with a
// `type` slot property, or a spread of another slot table by name. Required so
// an ordinary constant that happens to be spread somewhere isn't mistaken for a
// slot table.
//
// A slot table may itself spread one, and that is not a corner case: it is how
// `wiggleConfigSchemaFields` is built out of `scoreAxisConfigSchemaFields`, so
// a Manhattan plot can declare the score axis without the palette. Treating the
// spread as "not slot-shaped" rejected the whole outer table, which took every
// wiggle slot off the config pages while the schema still declared them — the
// same silent gap this index exists to close, one level down. Resolved in
// buildEnumConstantIndex's second pass, since the inner table may be declared
// after the outer one.
//
// `sf` is passed to getText explicitly rather than left to walk up parent
// pointers: a program's trees only get those once the checker binds the file,
// and this index runs before that.
function slotFieldParts(
  node: ts.Expression,
  sf: ts.SourceFile,
): SlotPart[] | undefined {
  if (!ts.isObjectLiteralExpression(node) || !node.properties.length) {
    return undefined
  }
  const parts = node.properties.map((p): SlotPart | undefined => {
    if (ts.isSpreadAssignment(p) && ts.isIdentifier(p.expression)) {
      return { spread: p.expression.text }
    }
    return ts.isPropertyAssignment(p) &&
      ts.isIdentifier(p.name) &&
      ts.isObjectLiteralExpression(p.initializer) &&
      p.initializer.properties.some(
        s =>
          ts.isPropertyAssignment(s) &&
          ts.isIdentifier(s.name) &&
          s.name.text === 'type',
      )
      ? { pair: [p.name.text, p.initializer.getText(sf)] }
      : undefined
  })
  // A table of nothing but spreads is not evidence of a slot table — every
  // property has to be recognized, and at least one has to be a slot.
  return parts.every(part => part !== undefined) &&
    parts.some(part => 'pair' in part)
    ? parts
    : undefined
}

// Flatten a table's parts against the resolved tables, in source order so a
// spread contributes where it is written. Undefined if any spread is unknown or
// ambiguous — the same "drop rather than guess" rule as everything else here.
function resolveSlotParts(
  parts: SlotPart[],
  resolved: Map<string, [string, string][] | null>,
): [string, string][] | undefined {
  const out: [string, string][] = []
  for (const part of parts) {
    if ('pair' in part) {
      out.push(part.pair)
      continue
    }
    const inner = resolved.get(part.spread)
    if (!inner) {
      return undefined
    }
    out.push(...inner)
  }
  // Object-spread semantics: a repeated name keeps its first position and takes
  // its last value, which is how a schema overrides one slot of a table it
  // spreads.
  const byName = new Map<string, string>()
  for (const [name, source] of out) {
    byName.set(name, source)
  }
  return [...byName].map(([name, source]) => [name, source])
}

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

interface Projection {
  name: string
  grouped: boolean
}

// `X.map(...)` / `X.flatMap(...)` -> the name of X, so a derived constant can be
// resolved from the table it projects. The projection itself isn't interpreted:
// every such table in the codebase maps to its tuple heads, and a table that
// didn't would surface as a wrong list, so we only accept the two shapes above.
function projectionSource(node: ts.Expression): Projection | undefined {
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

function recordScalar(name: string, value: string) {
  const prior = scalarIndex.get(name)
  if (prior === undefined) {
    scalarIndex.set(name, value)
  } else if (prior !== value) {
    scalarIndex.set(name, null)
  }
}

function recordSlotFields(name: string, pairs: [string, string][]) {
  const prior = slotFieldsIndex.get(name)
  if (prior === undefined) {
    slotFieldsIndex.set(name, pairs)
  } else if (prior === null || !samePairs(prior, pairs)) {
    slotFieldsIndex.set(name, null)
  }
}

// Same conflict rule one stage earlier, on the unresolved parts, so two files
// declaring the same table agree before either is flattened.
function recordSlotParts(
  parts: Map<string, SlotPart[] | null>,
  name: string,
  value: SlotPart[],
) {
  const prior = parts.get(name)
  if (prior === undefined) {
    parts.set(name, value)
  } else if (prior === null || !sameParts(prior, value)) {
    parts.set(name, null)
  }
}

function sameParts(a: SlotPart[], b: SlotPart[]) {
  return a.length === b.length && a.every((part, i) => samePart(part, b[i]!))
}

function samePart(a: SlotPart, b: SlotPart) {
  return 'pair' in a
    ? 'pair' in b && a.pair[0] === b.pair[0] && a.pair[1] === b.pair[1]
    : 'spread' in b && a.spread === b.spread
}

// Only a *conflicting* redefinition drops a name, matching record/recordScalar.
// Dropping on any second sighting also lost a table declared identically twice,
// which silently deletes every slot it contributes from every schema that
// spreads it.
function samePairs(a: [string, string][], b: [string, string][]) {
  return (
    a.length === b.length &&
    a.every(([name, value], i) => b[i]![0] === name && b[i]![1] === value)
  )
}

// What a tuple table can project to, precomputed so the derived pass compares
// values rather than syntax: two files declaring the same table with different
// formatting agree, the way samePairs' comment above requires.
interface TableProjections {
  heads: string[] | undefined
  groupedHeads: string[] | undefined
}

// The table map feeding derived resolution needs the same conflict rule as the
// three indexes above, or an ambiguous table still resolves its derived
// constant — off whichever file the program happened to parse last, which is
// exactly the guessing the module exists to avoid. `record` flags the table
// itself as ambiguous, but that says nothing about the projection of it.
function recordTable(
  tables: Map<string, TableProjections | null>,
  name: string,
  value: ts.Expression,
) {
  const projections = {
    heads: tupleHeads(value),
    groupedHeads: groupedTupleHeads(value),
  }
  const prior = tables.get(name)
  if (prior === undefined) {
    tables.set(name, projections)
  } else if (
    prior === null ||
    prior.heads?.join('\0') !== projections.heads?.join('\0') ||
    prior.groupedHeads?.join('\0') !== projections.groupedHeads?.join('\0')
  ) {
    tables.set(name, null)
  }
}

// And the derived constants themselves: `const B = A.map(...)` declared twice
// against different tables is ambiguous even when both tables resolve cleanly.
function recordDerived(
  derived: Map<string, Projection | null>,
  name: string,
  projection: Projection,
) {
  const prior = derived.get(name)
  if (prior === undefined) {
    derived.set(name, projection)
  } else if (
    prior === null ||
    prior.name !== projection.name ||
    prior.grouped !== projection.grouped
  ) {
    derived.set(name, null)
  }
}

/**
 * Scan already-parsed source files for top-level string-array constants. Takes
 * the shared program's trees (see createDocProgram) rather than paths: reparsing
 * the repo here cost a second full parse of everything the program already had.
 */
export function buildEnumConstantIndex(sourceFiles: ts.SourceFile[]) {
  const tables = new Map<string, TableProjections | null>()
  const derived = new Map<string, Projection | null>()
  const slotParts = new Map<string, SlotPart[] | null>()
  for (const sf of sourceFiles) {
    if (!/\bconst\s+[A-Za-z_$][\w$]*\s*=/.test(sf.text)) {
      continue
    }
    for (const stmt of sf.statements) {
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          const init = decl.initializer
          if (init && ts.isIdentifier(decl.name)) {
            const name = decl.name.text
            // `as const` wraps the literal in an assertion expression
            const value = ts.isAsExpression(init) ? init.expression : init
            const direct = stringsOf(value)
            const parts = slotFieldParts(value, sf)
            if (parts) {
              recordSlotParts(slotParts, name, parts)
            }
            if (ts.isStringLiteralLike(value)) {
              recordScalar(name, value.text)
            } else if (direct) {
              record(name, direct)
              recordTable(tables, name, value)
            } else if (tupleHeads(value) ?? groupedTupleHeads(value)) {
              recordTable(tables, name, value)
            } else {
              const projection = projectionSource(value)
              if (projection) {
                recordDerived(derived, name, projection)
              }
            }
          }
        }
      }
    }
  }
  // second pass: slot tables, now that every one of them has been seen. A table
  // that spreads another can only be flattened once that one is, so this runs to
  // a fixpoint rather than in one sweep — the chain is two deep today
  // (scoreAxis -> wiggle) and nothing here assumes that. Anything still
  // unresolved after it spreads a name that is unknown or ambiguous, and gets no
  // entry at all rather than a partial one.
  let resolvedCount = -1
  while (resolvedCount !== slotFieldsIndex.size) {
    resolvedCount = slotFieldsIndex.size
    for (const [name, parts] of slotParts) {
      if (parts && !slotFieldsIndex.has(name)) {
        const pairs = resolveSlotParts(parts, slotFieldsIndex)
        if (pairs) {
          recordSlotFields(name, pairs)
        }
      }
    }
  }
  // second pass: derived constants, now that every table is known. A null on
  // either side is an ambiguous name, and falls through to no entry in `index`
  // — i.e. the source-block fallback, not a guess.
  for (const [name, projection] of derived) {
    if (projection) {
      const table = tables.get(projection.name)
      const values = table
        ? projection.grouped
          ? table.groupedHeads
          : table.heads
        : undefined
      if (values) {
        record(name, values)
      }
    }
  }
}

/** Members of a named string-array constant, or undefined if unknown/ambiguous. */
export function enumConstantValues(name: string) {
  return index.get(name) ?? undefined
}

/** Value of a named string constant, or undefined if unknown/ambiguous. */
export function scalarConstantValue(name: string) {
  return scalarIndex.get(name) ?? undefined
}

/**
 * `slotName: { ... }` source pairs of a named slot-table constant a schema
 * spreads, or undefined if the name is unknown, ambiguous, or not slot-shaped.
 */
export function slotFieldConstantPairs(name: string) {
  return slotFieldsIndex.get(name) ?? undefined
}
