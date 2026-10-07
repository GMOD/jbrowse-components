import { types } from '@jbrowse/mobx-state-tree'

import { isCssColor } from '../util/cssColorParse.ts'
import { isJexl, stringToJexlExpression } from '../util/jexlStrings.ts'
import { FileLocation, JexlExpressionString } from '../util/types/mst.ts'
import { isCallbackValue } from './slotValueUtils.ts'

import type { JexlInstance } from '../util/jexlStrings.ts'
import type { IAnyType, SnapshotIn } from '@jbrowse/mobx-state-tree'

interface SlotTypeSpec {
  /** MST type of the slot's value */
  model: IAnyType
  /**
   * the fixed value the config editor falls back to when it converts a
   * callback back and the slot's default is itself a callback; absent on a
   * `maybe*` type, whose fixed form is unset
   */
  fallbackDefault?: unknown
}

function notAColor(value: unknown) {
  return `${JSON.stringify(value)} is not a color. A color is a CSS color: a name like "red" or "steelblue", "#rgb" / "#rrggbb" / "#rrggbbaa", "rgb()" / "rgba()" / "hsl()" / "hsla()", "transparent" or a BED triple like "255,0,0"; a color computed per feature is a "jexl:" callback, in a slot that takes one`
}

// '' is a color slot's "none", as in `outlineColor`
const CssColorType = types.refinement(
  'CssColor',
  types.string,
  value => value === '' || isCssColor(value),
  notAColor,
)

// a colour list's entry has no "none" to spell
const CssColorEntryType = types.refinement(
  'CssColorEntry',
  types.string,
  isCssColor,
  notAColor,
)

const MaybeFileLocation = types.snapshotProcessor(types.maybe(FileLocation), {
  preProcessor: (snap: SnapshotIn<typeof FileLocation> | undefined) =>
    snap &&
    (('uri' in snap && snap.uri === '') ||
      ('localPath' in snap && snap.localPath === ''))
      ? undefined
      : snap,
})

// The slot type vocabulary. `satisfies`, not an annotation, so the literal keys
// make up `ConfigSlotType`; every surface naming a type checks against it.
const slotTypes = {
  stringArray: { model: types.array(types.string), fallbackDefault: [] },
  expressionArray: {
    model: types.array(JexlExpressionString),
    fallbackDefault: [],
  },
  colorArray: { model: types.array(CssColorEntryType), fallbackDefault: [] },
  stringArrayMap: {
    model: types.map(types.array(types.string)),
    fallbackDefault: {},
  },
  numberMap: { model: types.map(types.number), fallbackDefault: {} },
  stringMap: { model: types.map(types.string), fallbackDefault: {} },
  boolean: { model: types.boolean, fallbackDefault: true },
  color: { model: CssColorType, fallbackDefault: 'black' },
  integer: { model: types.integer, fallbackDefault: 1 },
  number: { model: types.number, fallbackDefault: 1 },
  // a `maybe*` type's unset is `undefined`, the one value no config spells:
  // "decide from the data", as an auto-fitted height or a BED itemRgb colour
  maybeNumber: { model: types.maybe(types.number) },
  maybeBoolean: { model: types.maybe(types.boolean) },
  maybeColor: { model: types.maybe(CssColorType) },
  maybeFrozen: { model: types.maybe(types.frozen()) },
  maybeString: { model: types.maybe(types.string) },
  string: { model: types.string, fallbackDefault: '' },
  text: { model: types.string, fallbackDefault: '' },
  // a field the display reads per feature; its `jexl:` expression is the
  // display's to evaluate, never the reader's
  featureField: { model: types.string, fallbackDefault: '' },
  fileLocation: {
    model: FileLocation,
    fallbackDefault: {
      uri: '/path/to/resource.txt',
      locationType: 'UriLocation',
    },
  },
  // a sidecar the adapter works without; the editor's cleared `{ uri: '' }`
  // reads as unset
  maybeFileLocation: { model: MaybeFileLocation },
  frozen: { model: types.frozen(), fallbackDefault: {} },
} satisfies Record<string, SlotTypeSpec>

/** the types whose model this module supplies; `SlotValueByType` names the same set */
export type BuiltinSlotTypeName = keyof typeof slotTypes

// the author supplies the `types.enumeration` as `model`, and `ConfigSlot`
// wraps it in `types.maybe` or `types.array`
const ENUM_SLOT_TYPES = [
  'stringEnum',
  'maybeStringEnum',
  'stringEnumArray',
] as const

/**
 * Every legal `type` on a slot definition. Closed, since a name outside it
 * would still load with a `model` given, and every surface keyed on the name
 * would stop recognising the slot.
 */
export type ConfigSlotType =
  | keyof typeof slotTypes
  | (typeof ENUM_SLOT_TYPES)[number]

// the same set at runtime, for a JS plugin the type never checked
const CONFIG_SLOT_TYPE_NAMES = new Set<string>([
  ...Object.keys(slotTypes),
  ...ENUM_SLOT_TYPES,
])

const builtinSlotTypes: Partial<Record<ConfigSlotType, SlotTypeSpec>> =
  slotTypes

// an entry with no `fallbackDefault` is one whose fixed form is unset
const MAYBE_TYPES = new Set([
  ...Object.entries<SlotTypeSpec>(slotTypes)
    .filter(([, spec]) => spec.fallbackDefault === undefined)
    .map(([name]) => name),
  'maybeStringEnum',
])

// `MAYBE_TYPES` at the type level, off the same property
type MaybeBuiltinSlotTypeName = {
  [
    K in keyof typeof slotTypes
  ]: 'fallbackDefault' extends keyof (typeof slotTypes)[K] ? never : K
}[keyof typeof slotTypes]

export type MaybeSlotTypeName = MaybeBuiltinSlotTypeName | 'maybeStringEnum'

const JexlStringType = types.refinement('JexlString', types.string, isJexl)

const CALLBACK_SLOTS =
  'a slot that takes a callback declares the names it reads, which its config docs list as callback args'

function notACallbackSlot(value: unknown) {
  return `${JSON.stringify(value)} is a jexl: callback, and this slot takes a value: ${CALLBACK_SLOTS}`
}

/** Why the slot `name`, of type `type`, refuses `value` on a write. */
export function slotWriteRefusal(name: string, type: string, value: unknown) {
  const bare =
    type === 'expressionArray' && Array.isArray(value)
      ? value.find(entry => !isJexl(entry))
      : undefined
  return isJexl(value)
    ? `${name} takes no jexl: callback, and ${JSON.stringify(value)} is one: ${CALLBACK_SLOTS}`
    : bare !== undefined
      ? `${name} takes jexl: expressions, and ${JSON.stringify(bare)} is not an expression: write it with its prefix, as "jexl:${String(bare)}"`
      : `${name} is a ${type} slot and cannot take ${JSON.stringify(value)}`
}

function refusingCallbacks(model: IAnyType) {
  return types.refinement(model, value => !isJexl(value), notACallbackSlot)
}

interface ConfigSlotDefinitionCommon {
  /** human-readable description of the slot's meaning */
  description?: string
  /** custom base MST model for the slot's value */
  model?: IAnyType
  /**
   * The names a `jexl:` callback in this slot reads. Declaring any is what
   * makes the slot take a callback; every other slot refuses one.
   */
  contextVariable?: string[]
  /**
   * put this slot behind a toggle so common slots aren't crowded out by
   * rarely-changed ones: "Show advanced settings" in the config editor, and
   * the collapsed Advanced card in a track's About dialog, which also takes
   * every slot with a `contextVariable`
   */
  advanced?: boolean
}

/**
 * A slot definition: a `maybe*` type's `defaultValue` is optional, every
 * other's required. A `maybe*` default stays `unknown` rather than `undefined`
 * because a subclass override is spread over its base's, which no type can see;
 * `ConfigSlot` throws on a concrete one. An enum's `model` is optional for the
 * same spread: an override restating only the default inherits the vocabulary.
 */
export type ConfigSlotDefinition =
  | (ConfigSlotDefinitionCommon & {
      /** a `maybe*` slot type, whose unset state is `undefined` */
      type: MaybeSlotTypeName
      /** optional: unset is the default, and the only value `ConfigSlot` accepts */
      defaultValue?: unknown
    })
  | (ConfigSlotDefinitionCommon & {
      /** name of the type of slot, e.g. "string", "number", "stringArray" */
      type: Exclude<ConfigSlotType, MaybeSlotTypeName>
      /** default value of the slot; required, since no other value means "unset" */
      defaultValue: unknown
    })

/**
 * The MST property a slot is: its value type, or that or a `jexl:` callback
 * where the slot declares a `contextVariable` (ADR-155), stripped from the
 * snapshot at its default. Interning these was measured and declined
 * (`config-schema-construction` in `reference/EAGER_BUNDLE.md`).
 */
export default function ConfigSlot(definition: ConfigSlotDefinition) {
  const { model, type, defaultValue } = definition
  if (!CONFIG_SLOT_TYPE_NAMES.has(type)) {
    throw new Error(
      `config slot needs a known type name, got ${JSON.stringify(type)}`,
    )
  }
  const valueModel = model ?? builtinSlotTypes[type]?.model
  if (!valueModel) {
    throw new Error(
      `no builtin config slot type "${type}", and no 'model' param provided`,
    )
  }
  if (defaultValue === null) {
    throw new Error(
      `a slot cannot default to null, which a write reads as a reset to the default (ADR-146): a slot meaning "unset" is a maybe* type, such as maybeFrozen`,
    )
  }
  if (defaultValue === undefined && !MAYBE_TYPES.has(type)) {
    throw new Error("no 'defaultValue' provided")
  }
  // A concrete default makes a maybe* slot's unset state unreachable, with no
  // symptom. It arrives by inheritance: an override spread over a base slot's
  // default.
  if (defaultValue !== undefined && MAYBE_TYPES.has(type)) {
    throw new Error(
      `a "${type}" slot cannot have a concrete defaultValue (${JSON.stringify(defaultValue)}): unset is the state a maybe* slot exists for, and no config can spell undefined, so it would be unreachable. If this slot overrides a base slot, the base's defaultValue merged in — state 'defaultValue: undefined' to overwrite it. Otherwise use the non-maybe form of the type.`,
    )
  }
  const callback = !!definition.contextVariable?.length
  if (type === 'featureField' && callback) {
    throw new Error(
      'a "featureField" slot names a field the display reads per feature, and its jexl: expression is evaluated there, never called with a contextVariable. If this slot overrides a base callback slot, state \'contextVariable: undefined\'.',
    )
  }
  if (!callback && type !== 'featureField' && isJexl(defaultValue)) {
    throw new Error(
      `the defaultValue ${JSON.stringify(defaultValue)} is a jexl: callback, so the slot declares the contextVariable names it reads`,
    )
  }

  const value = enumShaped(type, valueModel)
  return types.stripDefault(
    callback
      ? types.union(JexlStringType, value)
      : type === 'featureField'
        ? value
        : refusingCallbacks(value),
    defaultValue,
  )
}

function enumShaped(type: ConfigSlotType, model: IAnyType) {
  return type === 'maybeStringEnum'
    ? types.maybe(model)
    : type === 'stringEnumArray'
      ? types.array(model)
      : model
}

/** A fixed value as the `jexl:` callback that returns it. */
export function toCallbackValue(value: unknown) {
  return isCallbackValue(value) ? value : `jexl:${JSON.stringify(value)}`
}

/**
 * New value when converting a jexl callback back to a fixed value: try
 * evaluating with no args, else fall back to the slot default (and to the slot
 * type's `fallbackDefault` if the default is itself a callback).
 */
export function toFixedValue(
  value: unknown,
  type: ConfigSlotType,
  defaultValue: unknown,
  jexl: JexlInstance,
) {
  if (!isCallbackValue(value)) {
    return value
  }
  try {
    const result = stringToJexlExpression(value, jexl).eval()
    if (result !== undefined) {
      return result
    }
  } catch {
    /* fall through to default */
  }
  if (isCallbackValue(defaultValue)) {
    const spec = builtinSlotTypes[type]
    if (spec?.fallbackDefault === undefined) {
      throw new Error(`no fallbackDefault defined for type ${type}`)
    }
    return spec.fallbackDefault
  }
  return defaultValue
}
