import { types } from '@jbrowse/mobx-state-tree'

import { FileLocation } from '../util/types/mst.ts'

import type { IAnyType } from '@jbrowse/mobx-state-tree'

function isValidColorString(_str: string) {
  // placeholder — all strings accepted; real CSS validation can be added later
  return true
}

const typeModels: Record<string, IAnyType> = {
  stringArray: types.array(types.string),
  stringArrayMap: types.map(types.array(types.string)),
  numberMap: types.map(types.number),
  boolean: types.boolean,
  color: types.refinement('Color', types.string, isValidColorString),
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
  /** parameter names of the function callback */
  contextVariable?: string[]
}

/**
 * A configuration slot is a plain value-union MST property: the slot's value
 * type, OR a `jexl:...` callback string. The value lives directly on the parent
 * configuration model — there is no per-slot sub-model. `types.stripDefault`
 * omits the property from the parent snapshot when it equals the default, so
 * saved sessions stay minimal. Per-slot metadata
 * (type/description/defaultValue/contextVariable) lives in the schema-type's
 * `jbrowseSchemaDefinition` table; jexl callbacks are evaluated on read by
 * `readConfObject`. See agent-docs/CONFIG_SLOT_COLLAPSE_PLAN.md.
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
  if (defaultValue === undefined) {
    throw new Error("no 'defaultValue' provided")
  }

  return types.stripDefault(
    types.union(JexlStringType, valueModel),
    defaultValue,
  )
}
