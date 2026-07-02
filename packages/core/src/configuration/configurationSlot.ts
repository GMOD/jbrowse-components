import { types } from '@jbrowse/mobx-state-tree'

import { isCallbackValue } from './slotValueUtils.ts'
import { isJexl, stringToJexlExpression } from '../util/jexlStrings.ts'
import { FileLocation } from '../util/types/mst.ts'

import type { JexlInstance } from '../util/jexlStrings.ts'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

interface SlotTypeSpec {
  /** MST type of the slot's value */
  model: IAnyType
  /**
   * value substituted when the config editor converts a callback back to a
   * fixed value but the slot's own default is itself a callback (see
   * `toFixedValue`). Omitted for `maybeNumber`, whose fixed form is genuinely
   * "unset" — that conversion path throws instead.
   */
  fallbackDefault?: unknown
}

// Single source of truth for the builtin slot type names, pairing each with its
// MST value type and its editor fallback default. Keeping model + fallback in
// one table means adding a slot type is one edit and can't half-register.
const slotTypes: Record<string, SlotTypeSpec> = {
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
  // a number that may be unset (`undefined`), so a display can distinguish "not
  // explicitly set" (fall back to a computed/auto value) from an explicit
  // number — e.g. a drag-resized track height. Defaults to `undefined`.
  //
  // There is deliberately no `maybeColor`/`maybeString`/etc.: nullability is
  // only warranted when the value space has no natural in-band sentinel (every
  // number is a legitimate height, so no magic number can mean "unset"). Types
  // that already carry meaningful specials should use one — a `color` slot uses
  // `''` for "no color" and a named theme-derived constant for "follow the
  // theme" (see THEME_DERIVED_COLOR), keeping a concrete string flowing to every
  // consumer (GPU packing, jexl, the editor) instead of forcing each to defend
  // against `undefined`.
  maybeNumber: { model: types.maybe(types.number) },
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
}

const JexlStringType = types.refinement('JexlString', types.string, isJexl)

export interface ConfigSlotDefinition {
  /** human-readable description of the slot's meaning */
  description?: string
  /** custom base MST model for the slot's value */
  model?: IAnyType
  /** name of the type of slot, e.g. "string", "number", "stringArray" */
  type: string
  /** default value of the slot */
  defaultValue: unknown
  /** parameter names of the function callback */
  contextVariable?: string[]
  /**
   * hide this slot behind a "Show advanced settings" toggle in the config
   * editor, so common slots aren't crowded out by rarely-changed ones
   */
  advanced?: boolean
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
export default function ConfigSlot({
  model,
  type,
  defaultValue,
}: ConfigSlotDefinition) {
  if (!type) {
    throw new Error('type name required')
  }
  const valueModel = model ?? slotTypes[type]?.model
  if (!valueModel) {
    throw new Error(
      `no builtin config slot type "${type}", and no 'model' param provided`,
    )
  }
  // `maybeNumber` intentionally defaults to `undefined` (the "unset" state);
  // every other slot type must declare a concrete default so a missing one is
  // caught as an authoring mistake.
  if (defaultValue === undefined && type !== 'maybeNumber') {
    throw new Error("no 'defaultValue' provided")
  }

  return types.stripDefault(
    types.union(JexlStringType, valueModel),
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
  type: string,
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
    const spec = slotTypes[type]
    if (spec?.fallbackDefault === undefined) {
      throw new Error(`no fallbackDefault defined for type ${type}`)
    }
    return spec.fallbackDefault
  }
  return defaultValue
}
