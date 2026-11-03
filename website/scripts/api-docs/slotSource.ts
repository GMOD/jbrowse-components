import * as ts from 'typescript'

import {
  enumConstantValues,
  literalConstantValue,
  numericConstantValue,
  scalarConstantValue,
} from './enumConstants.ts'
import { stripPropertyName } from './util.ts'

import type { Item } from './configTypes.ts'

export interface SlotMeta {
  type?: string
  description?: string
  defaultValue?: string
  enumValues?: string[]
  advanced?: boolean
  // `contextVariable`: the names a jexl callback on this slot receives
  contextVariable?: string[]
  // source of a default too long to render inline (a long array/object
  // literal), shown in the Default column behind a fold
  defaultCode?: string
  // source of a `model` that isn't an enumeration we could read the values of,
  // shown in the Type column
  typeCode?: string
  // source of a slot whose value isn't a plain object literal at all
  // (`pluginManager.pluggableConfigSchemaType('adapter')`), which has no type or
  // default to name — it is the whole description of the slot
  valueCode?: string
}

// A slot's value is an object literal (`{ type, description, defaultValue, ... }`).
// Surface its fields as table columns rather than leaving a reader to parse them
// out of a dumped code block: the in-object `description` becomes the slot's
// prose when no JSDoc was written, and type/default/enum/flags become cells.
export function parseSlotMeta(value: string): SlotMeta {
  const sf = ts.createSourceFile(
    'slot.ts',
    `const __x = ${value}`,
    ts.ScriptTarget.Latest,
    true,
  )
  const decl = sf.statements.find(ts.isVariableStatement)
  const init = decl?.declarationList.declarations[0]?.initializer
  const meta: SlotMeta = {}
  if (init && ts.isObjectLiteralExpression(init)) {
    for (const p of init.properties) {
      // a shorthand/spread/computed property, or a key no column names, can't
      // be summarized — the whole source stands in for it
      if (
        !(
          ts.isPropertyAssignment(p) &&
          ts.isIdentifier(p.name) &&
          applySlotProperty(meta, p.name.text, p.initializer)
        )
      ) {
        meta.valueCode = value
      }
    }
  } else {
    meta.valueCode = value
  }
  return meta
}

// Fills in the column this slot property feeds; false when the key is one no
// column covers.
function applySlotProperty(
  meta: SlotMeta,
  key: string,
  node: ts.Expression,
): boolean {
  if (key === 'type' && ts.isStringLiteralLike(node)) {
    meta.type = node.text
  } else if (key === 'description' && ts.isStringLiteralLike(node)) {
    meta.description = node.text
  } else if (key === 'defaultValue') {
    const inline = renderInlineDefault(node)
    if (inline === undefined) {
      meta.defaultCode = literalConstantValue(node) ?? node.getText()
    } else {
      meta.defaultValue = inline
    }
  } else if (key === 'model') {
    const values = enumerationValues(node)
    if (values) {
      meta.enumValues = values
    } else {
      meta.typeCode = node.getText()
    }
  } else if (
    key === 'advanced' &&
    (node.kind === ts.SyntaxKind.TrueKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword)
  ) {
    // `false` is recorded, not just skipped: an override states it to turn a
    // base slot's flag off, and that has to win over the inherited `true`
    meta.advanced = node.kind === ts.SyntaxKind.TrueKeyword
  } else if (key === 'contextVariable') {
    const names = ts.isArrayLiteralExpression(node)
      ? node.elements.filter(ts.isStringLiteralLike).map(e => e.text)
      : undefined
    if (
      names?.length ===
      (ts.isArrayLiteralExpression(node) ? node.elements.length : -1)
    ) {
      meta.contextVariable = names
    } else {
      return false
    }
  } else {
    return false
  }
  return true
}

// The values of a `types.enumeration('Name', ['a', 'b'])` model, so a stringEnum
// slot's choices show on the label line instead of only in the code block. A
// spread of a named constant (`[...HEIGHT_MODE_VALUES]`) resolves through the
// enum-constant index — schemas share those tables with the track menus, and a
// reader still needs the members.
function enumerationValues(node: ts.Expression): string[] | undefined {
  const arr = ts.isCallExpression(node)
    ? node.arguments.find(ts.isArrayLiteralExpression)
    : undefined
  const values = arr?.elements.flatMap(el =>
    ts.isStringLiteralLike(el)
      ? [el.text]
      : ts.isSpreadElement(el) && ts.isIdentifier(el.expression)
        ? (enumConstantValues(el.expression.text) ?? [])
        : [],
  )
  return values?.length ? values : undefined
}

// A default rendered compactly enough to sit on the label line: scalars,
// identifier/property references (defaultFilterFlags, Number.MIN_VALUE, null),
// and short object/array literals. Anything longer returns undefined so its
// shape stays legible in the code block instead.
const MAX_INLINE_DEFAULT = 72
function renderInlineDefault(node: ts.Expression): string | undefined {
  const isScalar =
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    ts.isIdentifier(node) ||
    ts.isPropertyAccessExpression(node)
  if (ts.isStringLiteralLike(node)) {
    return `'${node.text}'`
  }
  // A bare identifier that names a known string constant renders as its value —
  // a reader of `defaultValue: DEFAULT_SCORE_COLUMN` wants `'neg_log_pvalue'`.
  // Unresolvable or ambiguous names keep printing the identifier, which is what
  // non-string references (defaultFilterFlags, Number.MIN_VALUE) still do.
  const scalarConst = ts.isIdentifier(node)
    ? scalarConstantValue(node.text)
    : undefined
  if (scalarConst !== undefined) {
    return `'${scalarConst}'`
  }
  // Same for a number, unquoted. `defaultValue: GROW_MAX_HEIGHT` is written that
  // way because the ceiling is one fact shared with the mixin that caps against
  // it, and the reader still wants `800`.
  const numericConst = ts.isIdentifier(node)
    ? numericConstantValue(node.text)
    : undefined
  if (numericConst !== undefined) {
    return numericConst
  }
  // `node.text`, not `getText()`: `1_000_000` is valid TypeScript but not
  // valid JSON, and a reader pastes the default into a config.
  if (ts.isNumericLiteral(node)) {
    return node.text
  }
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    return `${ts.tokenToString(node.operator)}${node.operand.text}`
  }
  // Any other literal a name or a constant's member holds:
  // `GENE_GLYPH_DEFAULTS.subfeatureLabels` reads as its string. A long one goes to the
  // code block, which reads it the same way.
  const literal = literalConstantValue(node)
  if (literal !== undefined) {
    return literal.length <= MAX_INLINE_DEFAULT ? literal : undefined
  }
  if (isScalar) {
    return node.getText()
  }
  if (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) {
    const oneLine = node
      .getText()
      .replace(/\s+/g, ' ')
      .replace(/,(\s*[}\]])/g, '$1')
    return oneLine.length <= MAX_INLINE_DEFAULT ? oneLine : undefined
  }
  return undefined
}

// Effective meta for a slot that overrides one further up the
// `baseConfiguration` chain, filled in by `resolveInheritedSlotMeta`.
export const inheritedSlotMeta = new WeakMap<Item, SlotMeta>()

export function rawSlotValue(item: Item) {
  return stripPropertyName(item.code)
}

export function slotMetaFor(item: Item) {
  const value = rawSlotValue(item)
  return { value, meta: inheritedSlotMeta.get(item) ?? parseSlotMeta(value) }
}

// A slot whose source stands in for its type strips what the other columns
// already carry: the `description` (printed verbatim in the Description cell)
// and the blank lines JSDoc stripping leaves behind. Spliced by source range
// rather than by regex so a description wrapped across lines (prettier does
// this routinely) is removed whole.
function trimSlotCode(value: string) {
  const sf = ts.createSourceFile(
    'slot.ts',
    `const __x = ${value}`,
    ts.ScriptTarget.Latest,
    true,
  )
  const offset = 'const __x = '.length
  const init = sf.statements.find(ts.isVariableStatement)?.declarationList
    .declarations[0]?.initializer
  const description =
    init && ts.isObjectLiteralExpression(init)
      ? init.properties.find(
          p =>
            ts.isPropertyAssignment(p) &&
            ts.isIdentifier(p.name) &&
            p.name.text === 'description',
        )
      : undefined
  const stripped = description
    ? value.slice(0, description.getStart(sf) - offset) +
      value.slice(description.getEnd() - offset).replace(/^,/, '')
    : value
  return stripped.replace(/\n\s*\n+/g, '\n')
}

export function slotSourceCode(meta: SlotMeta) {
  return meta.typeCode ?? (meta.valueCode && trimSlotCode(meta.valueCode))
}
