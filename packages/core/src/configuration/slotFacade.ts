import { getSnapshot, getType } from '@jbrowse/mobx-state-tree'

import { getEnv } from '../util/index.ts'
import { getEnumerationValues } from '../util/mst-reflection.ts'
import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import {
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
} from './util.ts'

import type PluginManager from '../PluginManager.ts'
import type { ConfigSlotDefinition } from './configurationSlot.ts'
import type { AnyConfigurationModel } from './types.ts'

/**
 * The slot's metadata entry, or undefined when `slotName` names a nested
 * sub-schema or a string/number constant rather than a slot.
 */
function slotDefinition(
  node: AnyConfigurationModel,
  slotName: string,
): ConfigSlotDefinition | undefined {
  const def = getConfigurationSchemaDefinition(node)?.[slotName]
  return isSlotDefinitionEntry(def) ? def : undefined
}

/**
 * Whether `slotName` on a config node is a slot (vs a nested sub-schema or a
 * string/number constant).
 */
export function isConfigurationSlot(
  node: AnyConfigurationModel,
  slotName: string,
): boolean {
  return !!slotDefinition(node, slotName)
}

/**
 * Run `node`'s own schema `preProcessSnapshot` over a partial bag of slot
 * values headed for that config.
 *
 * A config.json snapshot gets this for free on `create`, but the session/URL
 * path writes slots one `setSlot` at a time onto an already-created config, so
 * without this a schema's shorthand expansions and legacy-key migrations apply
 * to `config.json` and silently no-op in a session spec, share link, or embed —
 * the surfaces that are supposed to speak the same vocabulary. The hooks are
 * written to normalize whatever subset of keys they're handed, so a partial bag
 * is the same shape they already tolerate.
 */
export function preProcessSlotValues(
  node: AnyConfigurationModel,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const preProcess = getConfigurationSchemaMetadata(getType(node))?.options
    .preProcessSnapshot
  return preProcess ? preProcess(values) : values
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
  /**
   * Whether the slot holds a non-default value. Each slot is `stripDefault`-
   * wrapped, so an at-default slot is omitted from the config snapshot — the
   * same signal the persistence/delta layer uses (robust for map/array slots
   * where a live-value `deepEqual` against the plain default would misfire). For
   * a promotable slot, "non-default" means customized rather than inheriting.
   */
  readonly modified: boolean
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
  const def = slotDefinition(node, slotName)
  if (!def) {
    throw new Error(`no slot metadata for ${slotName}`)
  }
  return def
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
    get modified() {
      return slotName in (getSnapshot(node) as Record<string, unknown>)
    },
    set(val: unknown) {
      node.setSlot(slotName, val)
    },
  }
}
