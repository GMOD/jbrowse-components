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
//   const D = O.map(o => o.value)                       // object table -> values
//
// The file grew three more indexes on the same principle — one fact, written
// once, and the docs following the indirection rather than the author retyping
// the value. Each says what it resolves and why below: a lone string constant, a
// lone numeric one, and a whole table of slots, the last in both its const and
// its factory form.
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
//   defaultValue: DEFAULT_SCORE_COLUMN
//
// A slot default is written that way for the same reason as the enum spreads
// above — the runtime default and the schema default are one fact — and the
// reader still wants the value, not the identifier. Same conflict rule: a name
// defined twice with different values is dropped, so it degrades to printing the
// identifier rather than documenting the wrong default.
const scalarIndex = new Map<string, string | null>()

// And for a *numeric* one, which is the same fact about the reader and a
// different fact about the rendering — a string default prints quoted and a
// number must not. Kept as its own index rather than a flag on the one above so
// neither call site can print the other's form.
//
// Slot defaults naming a shared number are common (`GROW_MAX_HEIGHT` is the
// grow ceiling both height-mode displays cap at, `MAX_LABEL_FEATURE_DENSITY`
// the zoom threshold the worker also reads), and every one of them used to
// print its identifier — 18 rows across the config pages telling a reader the
// name of the number instead of the number.
const numericIndex = new Map<string, string | null>()

// And for any literal a default names, or a member of a constant object:
//
//   defaultValue: GENE_GLYPH_DEFAULTS.subParts
//   defaultValue: DEFAULT_BIN_AS
//
// rendered the way an inline default is, so the Default cell shows
// `['start', 'end']` where it printed the name. A literal may itself name
// another constant (`field: DEFAULT_CANONICAL_TRANSCRIPTS.field`, a spread of
// one's list), so each constant's initializer is kept and read on lookup, once
// every file has been seen. Same conflict rule: a name whose initializers
// differ is dropped.
interface ConstantSource {
  node: ts.Expression
  sf: ts.SourceFile
  text: string
}
const constantSources = new Map<string, ConstantSource | null>()

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

// The same table, one indirection further out: a slot table written as a
// *function* of its per-display prose.
//
//   export function rowHeightConfigSchemaFields({ rowHeight = '…' }) {
//     return { rowHeight: { type: 'number', description: rowHeight }, ... } as const
//   }
//   ConfigurationSchema('LinearMarkDisplay', { ...rowHeightConfigSchemaFields({ rowHeight: '…' }) })
//
// A mixin's slots are shared in their types and defaults while their
// descriptions genuinely differ per display — a MAF row is a species, a
// multi-wiggle row a subtrack — so the shared table takes the sentences as
// arguments. The const form above cannot express that, so without this arm
// every such factory's slots would drop off the pages of the displays that
// spread it.
//
// A factory's recorded slot sources still name its parameters
// (`description: tree`), so the pairs are only meaningful once a call site's
// arguments are substituted in — hence the separate index and
// `slotFieldFactoryPairs` rather than an entry in `slotFieldsIndex`.

// One property of a factory's destructured parameter, keyed in `params` by the
// name the slot bodies reference (the binding), since a call site supplies it
// under a name that can differ (`{ tree: t }` is passed `tree` and read as `t`).
interface SlotFieldParam {
  /** the name a call site's argument object uses */
  prop: string
  /**
   * Source of the parameter's default, where it declares one. A default is a
   * real answer rather than a fallback: `rowHeightConfigSchemaFields`'s
   * `rowHeight` sentence is display-independent and most callers omit it, so
   * reading the default is the only way that slot's prose reaches their pages.
   */
  fallback: string | undefined
}

interface SlotFieldFactory {
  parts: SlotPart[]
  params: Map<string, SlotFieldParam>
}

// name -> the factory, or null on a conflict
const slotFieldFactoryIndex = new Map<string, SlotFieldFactory | null>()

// One entry of a slot table's source: a slot of its own, another slot table it
// spreads in by name, or a slot-table factory it spreads in as a call.
type SlotPart =
  | { pair: [string, string] }
  | { spread: string }
  | { call: string; args: Map<string, string> }

/**
 * The spread a schema or a slot table writes: a table by name
 * (`...wiggleConfigSchemaFields`) or a factory call with at most one
 * object-literal argument (`...trackHeightConfigSchemaFields({ … })`), the
 * single destructured parameter the factory index accepts. Anything else is
 * undefined rather than a half-read part.
 *
 * No argument at all is one of those shapes, not a rejection: a factory whose
 * every parameter has a default is spread as a bare
 * `...rowHeightConfigSchemaFields()`, and substitution then falls back to those
 * defaults exactly as it does for a parameter one call omits and another
 * passes. Rejecting it dropped the slot from the page of every display taking
 * the defaults, which the manifest gap check then reported as a missing `#slot`
 * tag on a file that has one.
 */
export function slotSpreadPart(
  expr: ts.Expression,
  sf: ts.SourceFile,
): SlotPart | undefined {
  if (ts.isIdentifier(expr)) {
    return { spread: expr.text }
  }
  if (!ts.isCallExpression(expr) || !ts.isIdentifier(expr.expression)) {
    return undefined
  }
  const [arg, ...rest] = expr.arguments
  if (rest.length || (arg && !ts.isObjectLiteralExpression(arg))) {
    return undefined
  }
  const args = new Map<string, string>()
  for (const p of arg?.properties ?? []) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
      args.set(p.name.text, p.initializer.getText(sf))
    }
  }
  return { call: expr.expression.text, args }
}

/**
 * The `slotName: { ... }` source pairs one part contributes, or undefined where
 * it spreads a name or calls a factory that is unknown or ambiguous.
 */
export function slotSpreadPairs(
  part: SlotPart,
): [string, string][] | undefined {
  if ('pair' in part) {
    return [part.pair]
  }
  if ('spread' in part) {
    return slotFieldConstantPairs(part.spread)
  }
  return slotFieldFactoryPairs(part.call, part.args)
}

// Slot-shaped object literal: every property is either `name: { ... }` with a
// `type` slot property, or a spread of another slot table by name or by factory
// call. Required so an ordinary constant that happens to be spread somewhere
// isn't mistaken for a slot table.
//
// A slot table may itself spread one, and that is not a corner case: it is how
// `wiggleConfigSchemaFields` is built out of `scoreAxisConfigSchemaFields`, so
// a Manhattan plot can declare the score axis without the palette, and how the
// arc displays' `ARC_COLOR_FIELD_SLOTS` is built out of display-kit's color
// slot factories. Treating the spread as "not slot-shaped" rejected the whole
// outer table, which took every wiggle slot off the config pages while the
// schema still declared them — the same silent gap this index exists to close,
// one level down. Resolved in buildEnumConstantIndex's second pass, since the
// inner table may be declared after the outer one.
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
    if (ts.isSpreadAssignment(p)) {
      return slotSpreadPart(p.expression, sf)
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
  // A table of nothing but spreads by name is not evidence of a slot table —
  // every property has to be recognized, and at least one has to be a slot or
  // a factory call, which resolves only against a factory this index knows.
  return parts.every(part => part !== undefined) &&
    parts.some(part => !('spread' in part))
    ? parts
    : undefined
}

// Flatten a table's parts against the resolved tables and factories, in source
// order so a spread contributes where it is written. Undefined if any spread is
// unknown or ambiguous — the same "drop rather than guess" rule as everything
// else here.
function resolveSlotParts(parts: SlotPart[]): [string, string][] | undefined {
  const out: [string, string][] = []
  for (const part of parts) {
    const pairs = slotSpreadPairs(part)
    if (!pairs) {
      return undefined
    }
    out.push(...pairs)
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

// A slot-table factory: one destructured object parameter, and a body that is a
// single `return <slot-shaped object literal>`. Deliberately that narrow — the
// point is to read a table whose shape is fixed and whose prose is supplied,
// not to interpret an arbitrary function, and anything else falls through to
// today's behaviour (the slots go undocumented, as they do now, rather than
// being documented wrongly).
function slotFieldFactory(
  fn: ts.FunctionDeclaration,
  sf: ts.SourceFile,
): SlotFieldFactory | undefined {
  const [param, ...rest] = fn.parameters
  if (
    !param ||
    rest.length ||
    !ts.isObjectBindingPattern(param.name) ||
    fn.body?.statements.length !== 1
  ) {
    return undefined
  }
  const [stmt] = fn.body.statements
  const returned =
    stmt && ts.isReturnStatement(stmt) ? stmt.expression : undefined
  if (!returned) {
    return undefined
  }
  const parts = slotFieldParts(
    ts.isAsExpression(returned) ? returned.expression : returned,
    sf,
  )
  if (!parts) {
    return undefined
  }
  const params = new Map<string, SlotFieldParam>()
  for (const el of param.name.elements) {
    if (ts.isIdentifier(el.name)) {
      const prop =
        el.propertyName && ts.isIdentifier(el.propertyName)
          ? el.propertyName.text
          : el.name.text
      params.set(el.name.text, { prop, fallback: el.initializer?.getText(sf) })
    }
  }
  return params.size ? { parts, params } : undefined
}

/**
 * Rewrite each identifier in `source` that names one of `params` with that
 * argument's own source, so a factory's `description: tree` becomes the sentence
 * the call site passed.
 *
 * Splices by position rather than reprinting: the caller strips the
 * `description` property back out of this text by offset (see
 * `slotSourceWithoutDescription`), so the result has to stay formatted the way
 * the factory wrote it.
 *
 * By AST position and never by regex — the identifier `heightMode` is both a
 * parameter of `heightModeConfigSchemaFields` and a **string literal** inside
 * the same slot (`types.enumeration('heightMode', …)`), so a textual
 * substitution replaces the enum's own name with a paragraph of prose.
 */
function substituteParams(
  source: string,
  params: Map<string, SlotFieldParam>,
  args: Map<string, string>,
) {
  const sf = ts.createSourceFile(
    'slot.ts',
    `const __slot = ${source}`,
    ts.ScriptTarget.Latest,
    true,
  )
  const edits: { start: number; end: number; text: string }[] = []
  const offset = `const __slot = `.length
  const visit = (node: ts.Node) => {
    // A property's *name* is not a reference to anything, so only its value is
    // walked. Shorthand (`{ description }`) is both at once and is left alone —
    // no factory here writes one, and rewriting it would need a name as well.
    if (ts.isPropertyAssignment(node)) {
      visit(node.initializer)
      return
    }
    const param = ts.isIdentifier(node) ? params.get(node.text) : undefined
    if (param) {
      const text = args.get(param.prop) ?? param.fallback
      if (text !== undefined) {
        edits.push({
          start: node.getStart(sf) - offset,
          end: node.getEnd() - offset,
          text,
        })
      }
      return
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sf, visit)
  let out = source
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  }
  return out
}

function recordConstantSource(
  name: string,
  node: ts.Expression,
  sf: ts.SourceFile,
) {
  const text = node.getText(sf)
  const prior = constantSources.get(name)
  if (prior === undefined) {
    constantSources.set(name, { node, sf, text })
  } else if (prior?.text !== text) {
    constantSources.set(name, null)
  }
}

// The initializer a `NAME` or `NAME.member` reference reads, as written.
function referencedSource(
  reference: ts.Expression,
): ConstantSource | undefined {
  if (ts.isIdentifier(reference)) {
    return constantSources.get(reference.text) ?? undefined
  }
  if (!ts.isPropertyAccessExpression(reference)) {
    return undefined
  }
  const owner = referencedSource(reference.expression)
  const object = owner && unwrapAssertion(owner.node)
  const member =
    object && ts.isObjectLiteralExpression(object)
      ? object.properties.find(
          (prop): prop is ts.PropertyAssignment =>
            ts.isPropertyAssignment(prop) &&
            prop.name.getText(owner.sf) === reference.name.text,
        )
      : undefined
  return member && owner
    ? {
        node: member.initializer,
        sf: owner.sf,
        text: member.initializer.getText(owner.sf),
      }
    : undefined
}

function unwrapAssertion(node: ts.Expression) {
  return ts.isAsExpression(node) || ts.isSatisfiesExpression(node)
    ? node.expression
    : node
}

// A literal's source in the inline-default spelling: strings single-quoted,
// arrays and objects on one line, a named constant read through. Undefined for
// anything holding a non-literal, and past a few references deep.
function literalText(
  node: ts.Expression,
  sf: ts.SourceFile,
  depth = 0,
): string | undefined {
  const value = unwrapAssertion(node)
  if (depth > 4) {
    return undefined
  }
  if (ts.isStringLiteralLike(value)) {
    return `'${value.text}'`
  }
  if (
    value.kind === ts.SyntaxKind.TrueKeyword ||
    value.kind === ts.SyntaxKind.FalseKeyword ||
    value.kind === ts.SyntaxKind.NullKeyword
  ) {
    return value.getText(sf)
  }
  const numeric = numericLiteralText(value, sf)
  if (numeric !== undefined) {
    return numeric
  }
  if (ts.isIdentifier(value) || ts.isPropertyAccessExpression(value)) {
    const source = referencedSource(value)
    return source && literalText(source.node, source.sf, depth + 1)
  }
  if (ts.isArrayLiteralExpression(value)) {
    const items = value.elements.map(e =>
      ts.isSpreadElement(e)
        ? literalText(e.expression, sf, depth + 1)?.replace(/^\[(.*)\]$/, '$1')
        : literalText(e, sf, depth),
    )
    return items.every(i => i !== undefined)
      ? `[${items.filter(Boolean).join(', ')}]`
      : undefined
  }
  if (ts.isObjectLiteralExpression(value)) {
    const entries = value.properties.map(prop => {
      const member = ts.isPropertyAssignment(prop)
        ? literalText(prop.initializer, sf, depth)
        : undefined
      return member === undefined
        ? undefined
        : `${prop.name!.getText(sf)}: ${member}`
    })
    return entries.every(e => e !== undefined)
      ? `{ ${entries.join(', ')} }`
      : undefined
  }
  return undefined
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

// The `value` of each entry in `[{ value: 'a', label: 'A' }, ...]`, the other
// shape a menu's option table takes — the one whose rows carry more than a label
// (a subLabel, help text) and so cannot be a pair.
function objectValueHeads(node: ts.Expression): string[] | undefined {
  if (!ts.isArrayLiteralExpression(node)) {
    return undefined
  }
  const values = node.elements
    .map(el =>
      ts.isObjectLiteralExpression(el)
        ? el.properties.find(
            pr =>
              ts.isPropertyAssignment(pr) &&
              ts.isIdentifier(pr.name) &&
              pr.name.text === 'value',
          )
        : undefined,
    )
    .map(pr =>
      pr &&
      ts.isPropertyAssignment(pr) &&
      ts.isStringLiteralLike(pr.initializer)
        ? pr.initializer.text
        : undefined,
    )
    .filter(v => v !== undefined)
  return values.length === node.elements.length && values.length
    ? values
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
// a table is tuples or objects, never both, so the shape of X decides what a
// flat map projects to. A table that mapped to something else would surface as a
// wrong list, so we only accept the shapes above.
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

// Author's own source, not the parsed value, so a separated literal keeps the
// separators a reader put there (`1_000_000`, never `1000000`).
function numericLiteralText(node: ts.Expression, sf: ts.SourceFile) {
  if (ts.isNumericLiteral(node)) {
    return node.getText(sf)
  }
  // A negative literal parses as a unary minus over one.
  return ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
    ? node.getText(sf)
    : undefined
}

// Every index here keeps the first sighting of a name and drops it to null on
// a conflicting one, so an ambiguous name documents nothing rather than
// whichever file the program happened to parse last. A redefinition that
// agrees keeps the name: dropping on any second sighting lost a table declared
// identically twice, and with it every slot it contributes. Maps compare by
// sorted entries, since a source's insertion order is not part of its value.
function recordUnique<T>(map: Map<string, T | null>, name: string, value: T) {
  const prior = map.get(name)
  if (prior === undefined) {
    map.set(name, value)
  } else if (prior === null || canonical(prior) !== canonical(value)) {
    map.set(name, null)
  }
}

function canonical(value: unknown) {
  return JSON.stringify(value, (_key, v: unknown) =>
    v instanceof Map
      ? [...v].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      : v,
  )
}

// What a tuple table can project to, precomputed so the derived pass compares
// values rather than syntax: two files declaring the same table with different
// formatting agree, the way samePairs' comment above requires.
interface TableProjections {
  heads: string[] | undefined
  groupedHeads: string[] | undefined
  valueProps: string[] | undefined
}

function tableProjections(value: ts.Expression): TableProjections {
  return {
    heads: tupleHeads(value),
    groupedHeads: groupedTupleHeads(value),
    valueProps: objectValueHeads(value),
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
    // Cheap prefilter. `function` is in it for the slot-table factories, whose
    // files hold nothing else — `rowHeightConfigSchemaFields.ts` has no
    // top-level `const` at all, so a const-only guard skipped the file and the
    // factory arm below would never have run. A `:` admits a typed const,
    // `const DEFAULT_BIN_AS: readonly [string, string] = ...`.
    if (
      !/\bconst\s+[A-Za-z_$][\w$]*\s*[:=]/.test(sf.text) &&
      !/\bfunction\s+[A-Za-z_$][\w$]*\s*\(/.test(sf.text)
    ) {
      continue
    }
    for (const stmt of sf.statements) {
      if (ts.isFunctionDeclaration(stmt) && stmt.name) {
        const factory = slotFieldFactory(stmt, sf)
        if (factory) {
          recordUnique(slotFieldFactoryIndex, stmt.name.text, factory)
        }
      }
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          const init = decl.initializer
          if (init && ts.isIdentifier(decl.name)) {
            const name = decl.name.text
            // `as const` wraps the literal in an assertion expression
            const value = ts.isAsExpression(init) ? init.expression : init
            recordConstantSource(name, value, sf)
            const direct = stringsOf(value)
            const numeric = numericLiteralText(value, sf)
            const parts = slotFieldParts(value, sf)
            if (parts) {
              recordUnique(slotParts, name, parts)
            }
            if (ts.isStringLiteralLike(value)) {
              recordUnique(scalarIndex, name, value.text)
            } else if (numeric !== undefined) {
              recordUnique(numericIndex, name, numeric)
            } else if (direct) {
              recordUnique(index, name, direct)
              recordUnique(tables, name, tableProjections(value))
            } else if (
              tupleHeads(value) ??
              groupedTupleHeads(value) ??
              objectValueHeads(value)
            ) {
              recordUnique(tables, name, tableProjections(value))
            } else {
              const projection = projectionSource(value)
              if (projection) {
                recordUnique(derived, name, projection)
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
        const pairs = resolveSlotParts(parts)
        if (pairs) {
          recordUnique(slotFieldsIndex, name, pairs)
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
          : (table.heads ?? table.valueProps)
        : undefined
      if (values) {
        recordUnique(index, name, values)
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
 * Source of a named numeric constant, or undefined if unknown/ambiguous.
 * Rendered unquoted, unlike {@link scalarConstantValue}.
 */
export function numericConstantValue(name: string) {
  return numericIndex.get(name) ?? undefined
}
// `NAME` or `NAME.member`'s literal, read through any constants it names.
export function literalConstantValue(reference: ts.Expression) {
  return ts.isIdentifier(reference) || ts.isPropertyAccessExpression(reference)
    ? literalText(reference, reference.getSourceFile())
    : undefined
}

/**
 * `slotName: { ... }` source pairs of a named slot-table constant a schema
 * spreads, or undefined if the name is unknown, ambiguous, or not slot-shaped.
 */
export function slotFieldConstantPairs(name: string) {
  return slotFieldsIndex.get(name) ?? undefined
}

/**
 * The same, for a slot table spread as a **call** —
 * `...rowHeightConfigSchemaFields({ rowHeight: '…' })` — with the
 * call's own arguments substituted for the factory's parameters, so each slot
 * carries the description this display passed rather than the parameter name.
 *
 * `args` maps a parameter name to the argument's source text. A parameter the
 * call omits falls back to the default the factory declares; one with neither
 * keeps its reference, which renders as a bare identifier — visible in the page
 * and caught by the blank-description gap check, rather than silently dropping
 * the slot.
 */
export function slotFieldFactoryPairs(
  name: string,
  args: Map<string, string>,
): [string, string][] | undefined {
  const factory = slotFieldFactoryIndex.get(name)
  if (!factory) {
    return undefined
  }
  const pairs = resolveSlotParts(factory.parts)
  return pairs?.map(([slot, source]) => [
    slot,
    substituteParams(source, factory.params, args),
  ])
}
