import * as ts from 'typescript'

import { schemaCallName, typesMemberName } from './astShapes.ts'
import {
  buildEnumConstantIndex,
  enumConstantValues,
  factorySchemaName,
  literalConstantValue,
  numericConstantValue,
  quoteString,
  referencedExpression,
  referencedObjectLiteral,
  scalarConstantValue,
  typeSchemaName,
  unwrapAssertion,
} from './enumConstants.ts'
import { stripPropertyName } from './util.ts'

import type { Item, SlotLocal, SlotLocals, SlotScope } from './configTypes.ts'
import type { ConstantIndex } from './enumConstants.ts'

// What a slot whose value is an MST type rather than a `{ type, ... }` object
// holds: another pluggable element's config (`'display'`), a schema by its
// `ConfigurationSchema` name, or a schema the factory declaring the slot takes
// as a parameter, which each caller chooses.
export type SlotHolds =
  | { element: string }
  | { schema: string }
  | { parameter: true }

export interface SlotMeta {
  type?: string
  // the slot holds a list of its type
  list?: boolean
  holds?: SlotHolds
  description?: string
  defaultValue?: string
  enumValues?: string[]
  // the literals a `types.union(types.number, types.literal('fit'))` model
  // takes beside its declared type
  literalValues?: string[]
  advanced?: boolean
  // `contextVariable`: the names a jexl callback on this slot receives
  contextVariable?: string[]
  // source of a slot whose value none of the above describes, which has no
  // type or default to name — it is the whole description of the slot
  valueCode?: string
}

const VALUE_PREFIX = 'const __x = '

function parseValue(value: string) {
  const sf = ts.createSourceFile(
    'slot.ts',
    `${VALUE_PREFIX}${value}`,
    ts.ScriptTarget.Latest,
    true,
  )
  const init = sf.statements.find(ts.isVariableStatement)?.declarationList
    .declarations[0]?.initializer
  return { sf, init }
}

// A slot's value is an object literal (`{ type, description, defaultValue, ... }`).
// Surface its fields as table columns rather than leaving a reader to parse them
// out of a dumped code block: the in-object `description` becomes the slot's
// prose when no JSDoc was written, and type/default/enum/flags become cells. A
// value that is an MST type instead is described by what it holds.
export function parseSlotMeta(
  value: string,
  scope: SlotScope,
  returnedCode?: string,
): SlotMeta {
  const { constants } = scope
  const { init } = parseValue(value)
  const slot =
    init &&
    (ts.isIdentifier(init) || ts.isPropertyAccessExpression(init)
      ? (referencedObjectLiteral(constants, init) ?? init)
      : init)
  const returned = returnedCode && parseValue(returnedCode).init
  const described =
    slot && !ts.isObjectLiteralExpression(slot)
      ? (describeValue(slot, scope, 0) ??
        (returned
          ? describeValue(returned, { constants, locals: new Map() }, 0)
          : undefined))
      : undefined
  return slot && ts.isObjectLiteralExpression(slot)
    ? objectSlotMeta(constants, slot, value)
    : described?.holds || described?.type
      ? described
      : { valueCode: value }
}

function objectSlotMeta(
  constants: ConstantIndex,
  slot: ts.ObjectLiteralExpression,
  value: string,
) {
  const meta: SlotMeta = {}
  for (const p of slot.properties) {
    // a shorthand/computed property, a spread of nothing the constant index
    // knows, or a key no column names, can't be summarized — the whole source
    // stands in for it
    if (!applySlotElement(constants, meta, p)) {
      meta.valueCode = value
    }
  }
  return meta
}

// A spread (`...regionTooLargeConfigSchemaFields.fetchSizeLimit`) applies the
// slot it names first, so the properties written after it override it, as
// object spread does.
function applySlotElement(
  constants: ConstantIndex,
  meta: SlotMeta,
  p: ts.ObjectLiteralElementLike,
): boolean {
  const spread = ts.isSpreadAssignment(p)
    ? referencedObjectLiteral(constants, p.expression)
    : undefined
  return spread
    ? spread.properties.every(member =>
        applySlotElement(constants, meta, member),
      )
    : ts.isPropertyAssignment(p) &&
        ts.isIdentifier(p.name) &&
        applySlotProperty(constants, meta, p.name.text, p.initializer)
}

// Fills in the column this slot property feeds; false when the key is one no
// column covers.
function applySlotProperty(
  constants: ConstantIndex,
  meta: SlotMeta,
  key: string,
  node: ts.Expression,
): boolean {
  if (key === 'type' && ts.isStringLiteralLike(node)) {
    meta.type = node.text
  } else if (key === 'description' && ts.isStringLiteralLike(node)) {
    meta.description = node.text
  } else if (key === 'defaultValue') {
    meta.defaultValue = renderDefault(constants, node)
  } else if (key === 'model') {
    meta.enumValues = enumerationValues(constants, node)
    meta.literalValues = meta.enumValues
      ? undefined
      : unionLiterals(constants, node)
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
function enumerationValues(
  constants: ConstantIndex,
  node: ts.Expression,
): string[] | undefined {
  const named = ts.isCallExpression(node) ? node.arguments.at(1) : undefined
  if (named && ts.isIdentifier(named)) {
    return enumConstantValues(constants, named.text)
  }
  const arr = ts.isCallExpression(node)
    ? node.arguments.find(ts.isArrayLiteralExpression)
    : undefined
  const values = arr?.elements.flatMap(el =>
    ts.isStringLiteralLike(el)
      ? [el.text]
      : ts.isSpreadElement(el) && ts.isIdentifier(el.expression)
        ? (enumConstantValues(constants, el.expression.text) ?? [])
        : [],
  )
  return values?.length ? values : undefined
}

// The `types.literal(...)` members of a `types.union(...)` model, each as its
// value, when every other member is a primitive type the slot's declared type
// already names.
function unionLiterals(
  constants: ConstantIndex,
  node: ts.Expression,
): string[] | undefined {
  const members =
    ts.isCallExpression(node) && node.expression.getText() === 'types.union'
      ? node.arguments
      : undefined
  const literals = members?.flatMap(member => {
    const arg =
      ts.isCallExpression(member) &&
      member.expression.getText() === 'types.literal'
        ? member.arguments[0]
        : undefined
    return arg
      ? [
          ts.isStringLiteralLike(arg)
            ? quoteString(arg.text)
            : ts.isIdentifier(arg)
              ? quoteString(
                  scalarConstantValue(constants, arg.text) ?? arg.text,
                )
              : arg.getText(),
        ]
      : []
  })
  return literals?.length ? literals : undefined
}

// How a default reads in a config: strings quoted, a named constant as its
// value — a reader of `defaultValue: DEFAULT_SCORE_COLUMN` wants
// `'neg_log_pvalue'`, of `defaultValue: GROW_MAX_HEIGHT` wants `800` — and
// anything else as its source. `undefined` is no default at all. Its length is
// the cell's business (`codeCell`), which folds a long one behind a dialog.
function renderDefault(constants: ConstantIndex, written: ts.Expression) {
  const node = unwrapAssertion(written)
  const name = ts.isIdentifier(node) ? node.text : undefined
  const scalar =
    name === undefined ? undefined : scalarConstantValue(constants, name)
  const numeric =
    name === undefined ? undefined : numericConstantValue(constants, name)
  return name === 'undefined'
    ? undefined
    : ts.isStringLiteralLike(node)
      ? quoteString(node.text)
      : scalar !== undefined
        ? quoteString(scalar)
        : numeric !== undefined
          ? numeric
          : // `node.text`, not `getText()`: `1_000_000` is valid TypeScript but
            // not valid JSON, and a reader pastes the default into a config.
            ts.isNumericLiteral(node)
            ? node.text
            : ts.isPrefixUnaryExpression(node) &&
                ts.isNumericLiteral(node.operand)
              ? `${ts.tokenToString(node.operator)}${node.operand.text}`
              : (numbersAsStrings(constants, node) ??
                literalConstantValue(constants, node) ??
                (ts.isObjectLiteralExpression(node) ||
                ts.isArrayLiteralExpression(node)
                  ? node.getText().replace(/,(\s*[}\]])/g, '$1')
                  : node.getText()))
}

// `QUALITY_OPACITY_RANGE.map(String)`, a constant list of numbers written as
// the strings a `stringArray` holds
function numbersAsStrings(constants: ConstantIndex, node: ts.Expression) {
  const list =
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'map' &&
    node.arguments[0]?.getText() === 'String'
      ? literalConstantValue(constants, node.expression.expression)
      : undefined
  const numbers = list ? /^\[(.*)\]$/.exec(list)?.[1]?.split(', ') : undefined
  return numbers?.every(n => /^-?[\d.]+$/.test(n))
    ? `[${numbers.map(quoteString).join(', ')}]`
    : undefined
}

// How many references, calls and wrappers deep `describeValue` follows a value
const DESCRIBE_DEPTH = 8

// What an MST type a slot's value spells holds, read through the locals and
// parameters of the factory declaring the schema and the constants the index
// knows. A member of `types.union` that holds nothing (`types.undefined`) is
// `{}`; undefined is a value this cannot read.
function describeValue(
  node: ts.Expression,
  scope: SlotScope,
  depth: number,
): SlotMeta | undefined {
  const { constants, locals } = scope
  const next = (expr: ts.Expression) => describeValue(expr, scope, depth + 1)
  const local = ts.isIdentifier(node) ? locals.get(node.text) : undefined
  const element = pluggableElement(node)
  const schema =
    schemaCallName(node) ??
    namedElementSchema(node) ??
    (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      ? factorySchemaName(constants, node.expression.text)
      : undefined)
  return depth > DESCRIBE_DEPTH
    ? undefined
    : ts.isNonNullExpression(node) ||
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node)
      ? next(node.expression)
      : local
        ? 'initializer' in local
          ? next(local.initializer)
          : { holds: parameterHolds(constants, local.typeName) }
        : element
          ? { holds: { element } }
          : schema
            ? { holds: { schema } }
            : node.getText() === 'types.undefined'
              ? {}
              : ts.isCallExpression(node)
                ? typesCallValue(constants, node, next)
                : ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)
                  ? referencedValue(constants, node, depth)
                  : undefined
}

// `pluginManager.pluggableConfigSchemaType('display')`
function pluggableElement(node: ts.Expression) {
  const [kind] =
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'pluggableConfigSchemaType'
      ? node.arguments
      : []
  return kind && ts.isStringLiteralLike(kind) ? kind.text : undefined
}

// `types.array`, `types.frozen`, `types.optional`, `types.maybe` and
// `types.union` around what they hold
function typesCallValue(
  constants: ConstantIndex,
  call: ts.CallExpression,
  next: (expr: ts.Expression) => SlotMeta | undefined,
) {
  const member = typesMemberName(call.expression)
  const [first, second] = call.arguments
  const inner = () => (first ? next(first) : undefined)
  const optional = member === 'optional' ? inner() : undefined
  const list = member === 'array' ? inner() : undefined
  return member === 'frozen'
    ? { type: 'frozen', defaultValue: first && renderDefault(constants, first) }
    : member === 'union'
      ? unionValue(call, next)
      : member === 'maybe'
        ? inner()
        : list
          ? { ...list, list: true }
          : optional && {
              ...optional,
              defaultValue: second && renderDefault(constants, second),
            }
}

// A schema typed by a `ReturnType<typeof factory>` alias names that factory's
// schema; any other is whichever one each caller passes
function parameterHolds(
  constants: ConstantIndex,
  typeName: string | undefined,
): SlotHolds {
  const schema = typeName && typeSchemaName(constants, typeName)
  return schema ? { schema } : { parameter: true }
}

function referencedValue(
  constants: ConstantIndex,
  node: ts.Expression,
  depth: number,
) {
  const referenced = referencedExpression(constants, node)
  return (
    referenced &&
    describeValue(referenced, { constants, locals: new Map() }, depth + 1)
  )
}

// A union of one kind of value beside members holding nothing, or every
// registered display's config, `types.union(...pluginManager.getDisplayElements()…)`
function unionValue(
  call: ts.CallExpression,
  next: (expr: ts.Expression) => SlotMeta | undefined,
) {
  const members = call.arguments.filter(a => !ts.isObjectLiteralExpression(a))
  const described = members.map(m =>
    ts.isSpreadElement(m)
      ? /\.getDisplayElements\(\)/.test(m.expression.getText())
        ? { holds: { element: 'display' } }
        : undefined
      : next(m),
  )
  const held = new Set(
    described.filter(d => d?.holds || d?.type).map(d => JSON.stringify(d)),
  )
  const [only] = held
  return described.every(d => d !== undefined) && held.size === 1 && only
    ? described.find(d => JSON.stringify(d) === only)
    : undefined
}

// `pluginManager.getTrackType('ReferenceSequenceTrack').configSchema`: one
// named element's config, by its type name
function namedElementSchema(node: ts.Expression) {
  let owner: ts.Expression | undefined =
    ts.isPropertyAccessExpression(node) && node.name.text === 'configSchema'
      ? node.expression
      : undefined
  while (owner && ts.isNonNullExpression(owner)) {
    owner = owner.expression
  }
  const [name] =
    owner &&
    ts.isCallExpression(owner) &&
    ts.isPropertyAccessExpression(owner.expression) &&
    /^get(?:Track|Display|Adapter|Connection|InternetAccount)Type$/.test(
      owner.expression.name.text,
    )
      ? owner.arguments
      : []
  return name && ts.isStringLiteralLike(name) ? name.text : undefined
}

// The consts and parameters a `#config` declaration's own source binds, which
// a slot naming one (`textSearchAdapter: optionalTextSearchAdapter`) reads as
// its value. A parameter keeps the type name it is annotated with, inside a
// destructured parameter's type literal too. A name bound twice binds neither.
export function scopeLocals(source: string): SlotLocals {
  const sf = ts.createSourceFile(
    'scope.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
  )
  const found = new Map<string, SlotLocal>()
  const twice = new Set<string>()
  const bind = (name: string, local: SlotLocal) => {
    if (found.has(name)) {
      twice.add(name)
    }
    found.set(name, local)
  }
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      bind(node.name.text, { initializer: node.initializer })
    } else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      bind(node.name.text, { typeName: typeNameOf(node.type) })
    } else if (ts.isParameter(node) && ts.isObjectBindingPattern(node.name)) {
      for (const el of node.name.elements) {
        const key = (el.propertyName ?? el.name).getText()
        const member =
          node.type && ts.isTypeLiteralNode(node.type)
            ? node.type.members.find(
                m => ts.isPropertySignature(m) && m.name.getText() === key,
              )
            : undefined
        if (ts.isIdentifier(el.name)) {
          bind(el.name.text, {
            typeName:
              member && ts.isPropertySignature(member)
                ? typeNameOf(member.type)
                : undefined,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  for (const name of twice) {
    found.delete(name)
  }
  return found
}

function typeNameOf(type: ts.TypeNode | undefined) {
  return type && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)
    ? type.typeName.text
    : undefined
}

// Each slot's meta, parsed once, and the meta of a slot that overrides one
// further up the `baseConfiguration` chain, merged by `inheritSlotMeta`.
const ownMeta = new WeakMap<Item, SlotMeta>()
const inheritedMeta = new WeakMap<Item, SlotMeta>()

function rawSlotValue(item: Item) {
  return stripPropertyName(item.code)
}

function ownSlotMeta(item: Item) {
  const cached = ownMeta.get(item)
  const meta =
    cached ??
    parseSlotMeta(
      rawSlotValue(item),
      item.scope ?? {
        constants: buildEnumConstantIndex([]),
        locals: new Map(),
      },
      item.returnedCode,
    )
  ownMeta.set(item, meta)
  return meta
}

export function slotMetaFor(item: Item) {
  return inheritedMeta.get(item) ?? ownSlotMeta(item)
}

/**
 * Fold an overriding slot's meta over the base slots it shadows, farthest
 * first, matching what `ConfigurationSchema` does at runtime
 * (`mergeSchemaDefinition`): a redeclared slot merges field-by-field over the
 * base's rather than replacing it.
 */
export function inheritSlotMeta(item: Item, bases: Item[]) {
  inheritedMeta.set(
    item,
    [...bases, item].reduce<SlotMeta>(
      (acc, slot) => ({ ...acc, ...ownSlotMeta(slot) }),
      {},
    ),
  )
}

// A `#slot` on a factory's argument (`domain: "the field's values…"`), whose
// row the slot that factory builds with it describes
export function isProseArgument(item: Item) {
  const { init } = parseValue(rawSlotValue(item))
  return !!init && ts.isStringLiteralLike(init)
}

// A slot whose source stands in for its type strips what the other columns
// already carry: the `description` (printed verbatim in the Description cell)
// and the blank lines JSDoc stripping leaves behind. Spliced by source range
// rather than by regex so a description wrapped across lines (prettier does
// this routinely) is removed whole.
export function slotSourceCode(meta: SlotMeta) {
  const value = meta.valueCode
  const { sf, init } = parseValue(value ?? '')
  const description =
    init && ts.isObjectLiteralExpression(init)
      ? init.properties.find(
          p =>
            ts.isPropertyAssignment(p) &&
            ts.isIdentifier(p.name) &&
            p.name.text === 'description',
        )
      : undefined
  const offset = VALUE_PREFIX.length
  const stripped =
    value && description
      ? value.slice(0, description.getStart(sf) - offset) +
        value.slice(description.getEnd() - offset).replace(/^,/, '')
      : value
  return stripped?.replace(/\n\s*\n+/g, '\n')
}
