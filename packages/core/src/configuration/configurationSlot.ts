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
  /**
   * make the slot nullable: its value may be `undefined` ("unset") in addition
   * to the declared `type`, and `defaultValue` may then be `undefined`. Use this
   * ONLY when a consumer must distinguish "not explicitly set" (fall back to a
   * computed/auto value) from an explicit value AND the value space has no
   * natural in-band sentinel — e.g. a drag-resized track `height`, where every
   * number is a legitimate height so no magic number can mean "unset".
   *
   * Prefer an in-band sentinel when the type already carries meaningful special
   * values: a `color` slot uses `''` for "no color" and a named theme-derived
   * constant for "follow the theme" (see THEME_DERIVED_COLOR), which keeps a
   * concrete string flowing to every consumer (GPU packing, jexl, the editor)
   * rather than forcing each to defend against `undefined`.
   */
  maybe?: boolean
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
  maybe,
}: ConfigSlotDefinition) {
  if (!type) {
    throw new Error('type name required')
  }
  const baseModel = model ?? typeModels[type]
  if (!baseModel) {
    throw new Error(
      `no builtin config slot type "${type}", and no 'model' param provided`,
    )
  }
  // a `maybe` slot may default to `undefined` (the "unset" state); every other
  // slot must declare a concrete default so a missing one is caught as an
  // authoring mistake.
  if (defaultValue === undefined && !maybe) {
    throw new Error("no 'defaultValue' provided")
  }

  const valueModel = maybe ? types.maybe(baseModel) : baseModel
  return types.stripDefault(
    types.union(JexlStringType, valueModel),
    defaultValue,
  )
}
