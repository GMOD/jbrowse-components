import { types } from '@jbrowse/mobx-state-tree'

import { freezeDeep } from '../util/freezeDeep.ts'
import { isJexl, stringToJexlExpression } from '../util/jexlStrings.ts'
import { FileLocation } from '../util/types/mst.ts'
import { isUsableValue } from './slotShape.ts'
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
  // computed/auto fallback (a drag-resized track height), or the inherit
  // sentinel every promotable slot needs (pair with `promotedBase`, and read
  // with `resolveConf`).
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

const JexlStringType = types.refinement('JexlString', types.string, isJexl)

export interface ConfigSlotDefinition {
  /** human-readable description of the slot's meaning */
  description?: string
  /** custom base MST model for the slot's value */
  model?: IAnyType
  /** name of the type of slot, e.g. "string", "number", "stringArray" */
  type: ConfigSlotType
  /** default value of the slot */
  defaultValue: unknown
  /** parameter names of the function callback */
  contextVariable?: string[]
  /**
   * hide this slot behind a "Show advanced settings" toggle in the config
   * editor, so common slots aren't crowded out by rarely-changed ones
   */
  advanced?: boolean
  /**
   * **Declaring this makes the slot promotable**, and it is the only thing that
   * does: a user can promote the slot's value to a session-wide default for all
   * tracks of the same display type (the track-menu pin). An *unset* slot
   * follows (inherits) that promoted default; any concrete value customizes the
   * track. Read it with `resolveConf`, never `getConf`; see
   * `promotableResolve.ts`.
   *
   * The value itself is what the unset state resolves to when a track inherits
   * and nothing is promoted. This is the CSS model — being unset is the
   * `inherit` keyword and `promotedBase` is `initial` (the value at the bottom
   * of the cascade). Spending only `undefined` on the sentinel is what leaves
   * every *real* value — `promotedBase` included — customizable over an opposite
   * session default, so a track can hold `displayMode: 'normal'` under a
   * promoted `'compact'`.
   *
   * Requires a `maybe*` slot type (whose `undefined` is the inherit sentinel)
   * and no `defaultValue`; `ConfigSlot` throws otherwise. A subclass turns an
   * inherited promotable slot back into a plain one by stating
   * `promotedBase: undefined` — the definition merge is a spread, so a stated
   * `undefined` really does overwrite the base's value.
   */
  promotedBase?: unknown
  /**
   * For a promotable slot: an extra semantic check a stored value must pass,
   * on top of the built-in type-shape check, before the cascade
   * (`promotableResolve.ts`'s `isUsableValue`) treats it as usable. Applies to
   * both cascade tiers — a session-wide promoted default and a track's own saved
   * value. Needed when a slot's shape alone can't catch a semantically-invalid
   * value — e.g. alignments `colorBy`'s `.type` must name a currently-registered
   * color scheme, not just be *some* string — so a stale scheme name (renamed or
   * removed since the value was saved) degrades to "not usable" (falls back to
   * the base) instead of reaching a lookup that assumes every `.type` is
   * registered. Omit when the type-shape check alone is enough to trust the value.
   *
   * Runs at **schema build** too, over the slot's own `promotedBase` — the base
   * is what every failing tier degrades to, so it has to clear the same bar.
   * Keep the hook a function of module-level data (as `isRegisteredColorScheme`
   * is of `COLOR_SCHEMES`); one that consults state its plugin registers later
   * during `install()` would reject a base that is really fine.
   */
  validate?: (value: unknown) => boolean
}

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
  const { model, type, defaultValue, promotedBase } = definition
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
  // `promotedBase` is what makes a slot promotable, so its presence is the whole
  // condition here (ADR-047).
  //
  // A promotable slot spends being-unset on the inherit sentinel, so it must be a
  // `maybe*` type. Any *concrete* default would double as the inherit signal,
  // making that one value un-customizable under an opposite promoted default — an
  // authoring mistake with no runtime symptom other than a setting that won't
  // stay put, so fail at construction.
  if (promotedBase !== undefined) {
    if (!MAYBE_TYPES.has(type)) {
      throw new Error(
        `a 'promotedBase' slot needs a maybe* type whose undefined is the inherit sentinel, not "${type}"`,
      )
    }
    if (defaultValue !== undefined) {
      throw new Error(
        "a promotable slot must leave 'defaultValue' undefined — that IS the inherit sentinel; 'promotedBase' is what an unset slot resolves to",
      )
    }
    // The base is the bottom of the cascade: every other tier that fails
    // `isUsableValue` falls back to it, so a base that would itself fail has
    // nowhere left to fall and every read of the slot returns a value no
    // consumer handles — with nothing thrown anywhere. The typo this catches is
    // a `promotedBase` outside the slot's own vocabulary (an enum member not in
    // `model`, a non-finite number), which nothing else in the system checks.
    if (!isUsableValue(definition, promotedBase)) {
      throw new Error(
        `a 'promotedBase' must be a value the slot can hold: ${JSON.stringify(promotedBase)} is not a valid "${type}"`,
      )
    }
    // The resolver hands `promotedBase` out by reference, so an object-valued one
    // (`maybeFrozen`, e.g. alignments `colorBy`) is one literal shared live by
    // every track sitting at base. Freeze it here, the only place it enters the
    // system, so mutating a resolved value throws instead of silently rewriting
    // the default for every other track — and for every later session, since this
    // object belongs to the schema. See `freezeDeep` for why by-reference stays.
    freezeDeep(promotedBase)
  }

  return types.stripDefault(
    types.union(
      JexlStringType,
      // `maybeStringEnum` is the only maybe type whose model comes from the
      // author: they write the plain vocabulary (`['fixed','grow','fit']`) and
      // the nullability is added here, so no enumeration has to carry a fake
      // member for the cascade's benefit.
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
