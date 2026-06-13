import { getType, isType } from '@jbrowse/mobx-state-tree'

import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import { getEnv } from '../util/index.ts'
import { getEnumerationValues } from '../util/mst-reflection.ts'

import type { ConfigSlotDefinition } from './configurationSlot.ts'
import type { AnyConfigurationModel } from './types.ts'
import type PluginManager from '../PluginManager.ts'

function slotTable(node: AnyConfigurationModel) {
  return getConfigurationSchemaMetadata(getType(node))?.definition
}

/**
 * Whether `slotName` on a config node is a slot (vs a nested sub-schema or a
 * string/number constant). The metadata table is the single source of truth: a
 * slot's entry is a plain ConfigSlotDefinition object, a sub-schema's entry is
 * an MST type, a constant's entry is a string/number.
 */
export function isConfigurationSlot(
  node: AnyConfigurationModel,
  slotName: string,
): boolean {
  const def = slotTable(node)?.[slotName]
  return !!def && typeof def === 'object' && !isType(def) && 'type' in def
}

/**
 * The duck-typed object the config editor's leaf components consume. They never
 * touch MST internals — only this shape (see ColorEditor.test.tsx, which passes
 * a plain object). It is built from `(parentNode, slotName)` + the schema
 * metadata table. Collection editors edit immutably via `set` (build a new
 * array/map and assign it).
 */
export interface SlotFacade {
  name: string
  description: string
  type: string
  contextVariable: string[]
  defaultValue: unknown
  /** enum choices, present only for `stringEnum` slots */
  choices?: string[]
  pluginManager: PluginManager
  readonly value: unknown
  set: (val: unknown) => void
}

/**
 * Look up a slot's metadata (type/description/defaultValue/contextVariable/
 * model) from the schema-type table stashed by ConfigurationSchema. Includes
 * slots inherited via `baseConfiguration`, which are merged into the table at
 * schema construction.
 */
export function getSlotDefinition(
  node: AnyConfigurationModel,
  slotName: string,
): ConfigSlotDefinition {
  const def = slotTable(node)?.[slotName]
  if (!def || typeof def !== 'object') {
    throw new Error(`no slot metadata for ${slotName}`)
  }
  return def as ConfigSlotDefinition
}

export function makeSlotFacade(
  node: AnyConfigurationModel,
  slotName: string,
): SlotFacade {
  const {
    type,
    description = '',
    defaultValue,
    contextVariable = [],
    model,
  } = getSlotDefinition(node, slotName)
  return {
    name: slotName,
    description,
    type,
    contextVariable,
    defaultValue,
    choices:
      type === 'stringEnum' && model ? getEnumerationValues(model) : undefined,
    pluginManager: getEnv(node).pluginManager,
    get value() {
      return node[slotName]
    },
    set(val: unknown) {
      node.setSlot(slotName, val)
    },
  }
}
