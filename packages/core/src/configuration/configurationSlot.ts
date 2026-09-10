import { types } from '@jbrowse/mobx-state-tree'

import { isJexl, stringToJexlExpression } from '../util/jexlStrings.ts'
import { FileLocation } from '../util/types/mst.ts'
import { isCallbackValue } from './slotValueUtils.ts'

import type { JexlInstance } from '../util/jexlStrings.ts'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

interface SlotTypeSpec {
  /** MST type of the slot's value */
  model: IAnyType
  /**
   * value substituted when the config editor converts a callback back to a
   * fixed value but the slot's own default is itself a callback (see
   * `toFixedValue`). Omitted for `maybeNumber`/`maybeBoolean`, whose fixed form
   * is genuinely "unset" — that conversion path throws instead.
   */
  fallbackDefault?: unknown
}

// Single source of truth for the builtin slot type names, pairing each with its
// MST value type and its editor fallback default. Keeping model + fallback in
// one table means adding a slot type is one edit and can't half-register.
//
// `satisfies` rather than an annotation: a `Record<string, …>` annotation
// widens the keys to `string`, which is what let `type: 'enum'` — a name this
// table has never had — compile for years and silently lose the config
// editor's dropdown. The literal keys are what `ConfigSlotType` below is made
// of.
const slotTypes = {
  stringArray: { model: types.array(types.string), fallbackDefault: [] },
  stringArrayMap: {
    model: types.map(types.array(types.string)),
    fallbackDefault: {},
  },
  numberMap: { model: types.map(types.number), fallbackDefault: {} },
  boolean: { model: types.boolean, fallbackDefault: true },
  // a color is just a string; the editor picks a color widget off the slot's
  // `type` metadata, and values are accepted unvalidated (CSS names, hex, jexl)
  color: { model: types.string, fallbackDefault: 'black' },
  integer: { model: types.integer, fallbackDefault: 1 },
  number: { model: types.number, fallbackDefault: 1 },
  // The `maybe*` types spend `undefined` on "not explicitly set", which is the
  // one value no config can spell and so the only reliable way to say it — a
  // computed/auto fallback, e.g. a drag-resized track height.
  maybeNumber: { model: types.maybe(types.number) },
  maybeBoolean: { model: types.maybe(types.boolean) },
  // for a slot whose unset state means "decide from the data" — a feature's own
  // BED itemRgb, say
  maybeColor: { model: types.maybe(types.string) },
  // object-valued, e.g. alignments `colorBy`
  maybeFrozen: { model: types.maybe(types.frozen()) },
  string: { model: types.string, fallbackDefault: '' },
  text: { model: types.string, fallbackDefault: '' },
  fileLocation: {
    model: FileLocation,
    fallbackDefault: {
      uri: '/path/to/resource.txt',
      locationType: 'UriLocation',
    },
  },
  frozen: { model: types.frozen(), fallbackDefault: {} },
} satisfies Record<string, SlotTypeSpec>

/**
 * The builtin table's own names — every slot type whose MST model this module
 * supplies, so excluding the two enum types. Exported for `SlotValueByType` in
 * `types.ts`, which has to name the same set and is checked against this.
 */
export type BuiltinSlotTypeName = keyof typeof slotTypes

// The two types with no builtin table entry, because the author supplies the
// `types.enumeration` as `model`. Named once, and spliced into both the type
// union and the runtime set below so those two cannot drift apart.
const ENUM_SLOT_TYPES = ['stringEnum', 'maybeStringEnum'] as const

/**
 * Every legal `type` on a slot definition: the builtin table's own names, plus
 * the two enum types.
 *
 * Closed on purpose. A name outside this set still *works* at runtime as long
 * as a `model` is given — which is exactly the trap: the value round-trips
 * fine, and the only symptom is that everything keyed off the type name stops
 * recognising the slot (`slotFacade` hands the editor no `choices`, so an enum
 * renders as a free text box).
 */
export type ConfigSlotType =
  | keyof typeof slotTypes
  | (typeof ENUM_SLOT_TYPES)[number]

/**
 * The same closed set, at runtime, because the type alone does not close it for
 * the callers that matter most: `ConfigSlot` is plugin-facing, and a JS plugin
 * or one built against an older core reaches it with no checking at all. Those
 * are exactly the callers that hit the silent-degradation trap above, and
 * `type: 'enum'` — a name this table has never had — is the one that did.
 *
 * Typed `Set<string>` rather than `Set<ConfigSlotType>` so the membership test
 * stays a question TypeScript has not already answered for in-tree callers. It
 * is a real runtime check, not a restatement of the signature.
 */
const CONFIG_SLOT_TYPE_NAMES = new Set<string>([
  ...Object.keys(slotTypes),
  ...ENUM_SLOT_TYPES,
])

// Lookup view over the table. The two enum types are legal `ConfigSlotType`s
// with no entry, so indexing by the union has to tolerate a miss — this states
// that in the type rather than casting it away at each call.
const builtinSlotTypes: Partial<Record<ConfigSlotType, SlotTypeSpec>> =
  slotTypes

// The slot types whose default is `undefined` — the genuine "unset" state,
// distinguishable from every value a config can spell. Mostly derived from the
// table above (they're exactly the entries with no `fallbackDefault`, since
// "unset" is their fixed form) so the two can't drift. `maybeStringEnum` is
// named explicitly because, like plain `stringEnum`, it has no builtin model:
// the author supplies the enumeration and `ConfigSlot` wraps it in
// `types.maybe`.
const MAYBE_TYPES = new Set([
  ...Object.entries<SlotTypeSpec>(slotTypes)
    .filter(([, spec]) => spec.fallbackDefault === undefined)
    .map(([name]) => name),
  'maybeStringEnum',
])

/**
 * The same set as `MAYBE_TYPES`, at the type level, and derived from the same
 * property of the same table so the two cannot disagree: an entry with no
 * `fallbackDefault` is one whose fixed form is "unset".
 */
type MaybeBuiltinSlotTypeName = {
  [
    K in keyof typeof slotTypes
  ]: 'fallbackDefault' extends keyof (typeof slotTypes)[K] ? never : K
}[keyof typeof slotTypes]

export type MaybeSlotTypeName = MaybeBuiltinSlotTypeName | 'maybeStringEnum'

const JexlStringType = types.refinement('JexlString', types.string, isJexl)

interface ConfigSlotDefinitionCommon {
  /** human-readable description of the slot's meaning */
  description?: string
  /** custom base MST model for the slot's value */
  model?: IAnyType
  /** parameter names of the function callback */
  contextVariable?: string[]
  /**
   * hide this slot behind a "Show advanced settings" toggle in the config
   * editor, so common slots aren't crowded out by rarely-changed ones
   */
  advanced?: boolean
}

/**
 * A slot definition, split on whether the slot's type spends `undefined` on
 * "unset". The type-level twin of `ConfigSlot`'s
 * `defaultValue === undefined && !MAYBE_TYPES.has(type)` throw, which used to be
 * the only statement of the rule: a `maybe*` slot has exactly one legal
 * `defaultValue`, so requiring the field of every slot alike made 81 slots
 * across the repo carry a `defaultValue: undefined` line that said nothing.
 *
 * A `maybe*` slot's only legal `defaultValue` is the sentinel itself, but the
 * field stays `unknown` rather than being pinned to `undefined`: the spread in
 * `mergeSchemaDefinition` combines a base and a child whose halves may disagree,
 * so pinning it forces a cast through the one place slot definitions are
 * combined. `ConfigSlot` throws on a concrete one instead — and has to anyway,
 * since no type can see what a `baseConfiguration` merged in, which is the way
 * this mistake actually happens.
 *
 * Stating the sentinel stays meaningful in a subclass override, where the merge
 * is a spread and an omitted key inherits the base's value.
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
 * A configuration slot is a plain value-union MST property: the slot's value
 * type, OR a `jexl:...` callback string. The value lives directly on the parent
 * configuration model — there is no per-slot sub-model. `types.stripDefault`
 * omits the property from the parent snapshot when it equals the default, so
 * saved sessions stay minimal. Per-slot metadata
 * (type/description/defaultValue/contextVariable) lives in the schema registry
 * (a WeakMap keyed by the MST type, see schemaRegistry.ts); jexl callbacks are
 * evaluated on read by `readConfObject`.
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
  // the `maybe*` types intentionally default to `undefined` (the "unset"
  // state); every other slot type must declare a concrete default so a missing
  // one is caught as an authoring mistake.
  if (defaultValue === undefined && !MAYBE_TYPES.has(type)) {
    throw new Error("no 'defaultValue' provided")
  }
  // The inverse of the `defaultValue === undefined` check above, and the half
  // that had no guard. A `maybe*` slot whose default is concrete can never *be*
  // unset — no config can spell `undefined` — so the unset state such a slot
  // exists to express (auto-fit, decide-from-the-data, inherit) is unreachable
  // and the branch reading it never runs. There is no symptom: the slot reads as
  // a perfectly good value everywhere.
  //
  // The way this happens is **inheritance**, which is why the type can't catch
  // it: a `maybe*` override of a plain base slot inherits the base's concrete
  // default through the definition spread, and the override's own literal looks
  // right. `LinearMafDisplay.height` over `BaseLinearDisplay`'s `number`/100 is
  // the case in the repo, and only that display's own tests noticed.
  if (defaultValue !== undefined && MAYBE_TYPES.has(type)) {
    throw new Error(
      `a "${type}" slot cannot have a concrete defaultValue (${JSON.stringify(defaultValue)}): unset is the state a maybe* slot exists for, and no config can spell undefined, so it would be unreachable. If this slot overrides a base slot, the base's defaultValue merged in — state 'defaultValue: undefined' to overwrite it. Otherwise use the non-maybe form of the type.`,
    )
  }

  return types.stripDefault(
    types.union(
      JexlStringType,
      // `maybeStringEnum` is the only maybe type whose model comes from the
      // author: they write the plain vocabulary and the nullability is added
      // here.
      type === 'maybeStringEnum' ? types.maybe(valueModel) : valueModel,
    ),
    defaultValue,
  )
}

/**
 * New value when converting a fixed-value slot to a jexl callback. Already-
 * callback values are returned unchanged.
 *
 * A single JSON.stringify covers every type: `jexl:${42}` and
 * `jexl:${JSON.stringify(42)}` are identical for numbers/booleans, and the rest
 * need the quoting/serialization anyway.
 */
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
