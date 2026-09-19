import {
  getSnapshot,
  getType,
  isArrayType,
  isMapType,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'

import { getEnumerationValues } from '../util/mst-reflection.ts'
import { getEnv } from '../util/mstUtils.ts'
import ConfigSlot from './configurationSlot.ts'
import {
  getConfigurationSchemaDefinition,
  getConfigurationSchemaMetadata,
  getConfigurationSchemaOptions,
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
 * Whether `slotName` on a config node is a single nested sub-schema, the kind
 * `setSubschema` replaces whole (not an array or map of them).
 */
export function isConfigurationSubschema(
  node: AnyConfigurationModel,
  slotName: string,
): boolean {
  const def = getConfigurationSchemaDefinition(node)?.[slotName]
  return isConfigurationSchemaType(def) && !isArrayType(def) && !isMapType(def)
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function deepMerge(
  base: Record<string, unknown>,
  over: Record<string, unknown>,
) {
  const out = { ...base }
  for (const [k, v] of Object.entries(over)) {
    const prev = out[k]
    out[k] = isPlainObject(prev) && isPlainObject(v) ? deepMerge(prev, v) : v
  }
  return out
}

/**
 * What to hand `setSubschema` for a write of `slotName`: `value` itself where
 * the sub-schema is a channel, and the node's own snapshot with `value`'s
 * members over it — recursing where both sides are plain objects — where it is
 * not.
 *
 * **A `shorthand` is what tells the two apart.** A sub-schema that takes a bare
 * string takes one written value, so `{ field: 'biotype' }` after
 * `{ field: 'biotype', domain: [...] }` is a colour or facet with no domain,
 * and a merge would leave the old one standing with no way to clear it. A
 * sub-schema with no shorthand is a namespace of independent settings, where
 * `{ scales: { y: { domainMin: 5 } } }` means "pin the bottom" and used to
 * reset `type` and `autoscale` with it.
 */
export function mergedSubschemaValue(
  node: AnyConfigurationModel,
  slotName: string,
  value: unknown,
) {
  const existing = (node as unknown as Record<string, unknown>)[slotName]
  if (!isPlainObject(value) || !isStateTreeNode(existing)) {
    return value ?? {}
  }
  const snap = getSnapshot(existing as AnyConfigurationModel)
  return getConfigurationSchemaOptions(existing as AnyConfigurationModel)
    ?.shorthand === undefined && isPlainObject(snap)
    ? deepMerge(snap, value)
    : value
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
  const schema = getConfigurationSchemaMetadata(getType(node))
  return schema ? preProcessSnapshotWith(schema, values) : values
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
  try {
    const lifted = preProcessSnapshotWith(meta, { [key]: value })[key]
    if (subSchema) {
      subSchema.create(lifted)
    } else if (isSlotDefinitionEntry(entry) && !ConfigSlot(entry).is(lifted)) {
      return `${meta.name}.${key} is a ${entry.type} slot and cannot take ${JSON.stringify(value)}`
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
  /** enum choices, present only for `stringEnum`/`maybeStringEnum` slots */
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
 * author's own `types.enumeration` off `model` — `stringEnum` and
 * `maybeStringEnum` are the only two types the editor takes choices from, so a
 * slot typed anything else renders as free text however valid its `model` is.
 *
 * Shared by the config editor's facade below and by
 * `ConfigSlotDefaults.test.ts`, which snapshots every schema's vocabularies:
 * dropping a member is a silent compatibility break, since a saved session
 * holding it fails MST validation and the track then fails to hydrate.
 */
export function slotChoices(def: ConfigSlotDefinition): string[] | undefined {
  const { type, model } = def
  return (type === 'stringEnum' || type === 'maybeStringEnum') && model
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
      node.setSlot(slotName, val)
    },
  }
}
