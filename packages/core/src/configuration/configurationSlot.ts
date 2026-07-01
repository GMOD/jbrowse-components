import { types } from '@jbrowse/mobx-state-tree'

import { FileLocation } from '../util/types/mst.ts'

import type { IAnyType } from '@jbrowse/mobx-state-tree'

const typeModels: Record<string, IAnyType> = {
  stringArray: types.array(types.string),
  stringArrayMap: types.map(types.array(types.string)),
  numberMap: types.map(types.number),
  boolean: types.boolean,
  // a color is just a string; the editor picks a color widget off the slot's
  // `type` metadata, and values are accepted unvalidated (CSS names, hex, jexl)
  color: types.string,
  integer: types.integer,
  number: types.number,
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
  maybeNumber: types.maybe(types.number),
  string: types.string,
  text: types.string,
  fileLocation: FileLocation,
  frozen: types.frozen(),
}

const JexlStringType = types.refinement('JexlString', types.string, str =>
  str.startsWith('jexl:'),
)

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
  const valueModel = model ?? typeModels[type]
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
