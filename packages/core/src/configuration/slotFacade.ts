import { asModelType, getSnapshot } from '@jbrowse/mobx-state-tree'

import { getEnumerationValues } from '../util/mst-reflection.ts'
import { getEnv } from '../util/mstUtils.ts'
import { slotWriteRefusal } from './configurationSlot.ts'
import { setConf } from './getConf.ts'
import {
  getConfigurationSchemaDefinition,
  getConfigurationSchemaMetadata,
} from './schemaRegistry.ts'
import {
  isConfigurationSchemaType,
  isSlotDefinitionEntry,
} from './schemaTypes.ts'
import { preProcessSnapshotWith } from './snapshotPreprocess.ts'

import type PluginManager from '../PluginManager.ts'
import type {
  ConfigSlotDefinition,
  ConfigSlotType,
} from './configurationSlot.ts'
import type { AnyConfigurationModel } from './types.ts'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

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
 * Why a config of type `schema` cannot hold `value` at `key`, or undefined
 * when it can: the schema's own lift first, then the slot's type, or a
 * sub-schema's lift and checks. Also undefined for a key the schema does not
 * declare, which is a question for its caller.
 */
export function slotValueRefusal(
  schema: IAnyType,
  key: string,
  value: unknown,
): string | undefined {
  const meta = getConfigurationSchemaMetadata(schema)
  const entry = meta?.definition[key]
  if (!meta || entry === undefined) {
    return undefined
  }
  const subSchema: IAnyType | undefined = isConfigurationSchemaType(entry)
    ? entry
    : undefined
  // the slot's own property type, built once with the schema: what `setSlot`
  // checks a write against
  const slotType = asModelType(schema)?.properties[key]
  try {
    const lifted = preProcessSnapshotWith(meta, { [key]: value })[key]
    if (subSchema) {
      subSchema.create(lifted)
    } else if (isSlotDefinitionEntry(entry) && !slotType?.is(lifted)) {
      return slotWriteRefusal(`${meta.name}.${key}`, entry.type, value)
    }
    return undefined
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
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
  type: ConfigSlotType
  contextVariable: string[]
  defaultValue: unknown
  /**
   * enum choices, present only for the enum slot types; a `stringEnumArray`'s
   * are the choices of each entry
   */
  choices?: string[]
  pluginManager: PluginManager
  readonly value: unknown
  /**
   * Whether the slot holds a non-default value. Each slot is `stripDefault`-
   * wrapped, so an at-default slot is omitted from the config snapshot — the
   * same signal the persistence/delta layer uses (robust for map/array slots
   * where a live-value `deepEqual` against the plain default would misfire).
   */
  readonly modified: boolean
  set: (val: unknown) => void
}

/**
 * The vocabulary an enum slot offers, or undefined for any other slot. Reads the
 * author's own `types.enumeration` off `model` — the enum types are the only
 * ones the editor takes choices from, so a slot typed anything else renders as
 * free text however valid its `model` is.
 *
 * Shared by the config editor's facade below and by
 * `ConfigSlotDefaults.test.ts`, which snapshots every schema's vocabularies:
 * dropping a member is a silent compatibility break, since a saved session
 * holding it fails MST validation and the track then fails to hydrate.
 */
export function slotChoices(def: ConfigSlotDefinition): string[] | undefined {
  const { type, model } = def
  return (type === 'stringEnum' ||
    type === 'maybeStringEnum' ||
    type === 'stringEnumArray') &&
    model
    ? getEnumerationValues(model)
    : undefined
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
  const definition = getSlotDefinition(node, slotName)
  const {
    type,
    description = '',
    defaultValue,
    contextVariable = [],
  } = definition
  return {
    name: slotName,
    description,
    type,
    contextVariable,
    defaultValue,
    choices: slotChoices(definition),
    pluginManager: getEnv(node).pluginManager,
    get value() {
      return node[slotName]
    },
    get modified() {
      return slotName in (getSnapshot(node) as Record<string, unknown>)
    },
    set(val: unknown) {
      setConf(node, slotName, val)
    },
  }
}
