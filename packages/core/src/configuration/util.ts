import {
  getEnv,
  getSnapshot,
  getType,
  isArrayType,
  isLateType,
  isMapType,
  isModelType,
  isOptionalType,
  isStateTreeNode,
  isType,
  isUnionType,
} from '@jbrowse/mobx-state-tree'

import {
  getConfigurationSchemaMetadata,
  isRegisteredConfigurationSchema,
} from './schemaRegistry.ts'
import { evaluateJexl, isCallbackValue } from './slotValueUtils.ts'
import {
  getDefaultValue,
  getSubType,
  getUnionSubTypes,
  resolveLateType,
} from '../util/mst-reflection.ts'

import type { ConfigSlotDefinition } from './configurationSlot.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValue,
} from './types.ts'
import type { Feature } from '../util/index.ts'
import type { JexlInstance } from '../util/jexlStrings.ts'
import type { IMSTMap } from '@jbrowse/mobx-state-tree'

// Evaluate a slot's `jexl:...` callback string. The pluginManager's jexl
// instance (carrying plugin-registered functions) comes from the config node's
// env; a plain-object config falls back to the default jexl instance.
function evalConfigCallback(
  expr: string,
  args: Record<string, unknown>,
  confObject: unknown,
) {
  const jexl = isStateTreeNode(confObject)
    ? getEnv<{ pluginManager?: { jexl?: JexlInstance } }>(confObject)
        .pluginManager?.jexl
    : undefined
  return evaluateJexl(expr, args, jexl)
}

// A config readable by readConfObject: a normal schema model, or a top-level
// types.map of sub-schemas (e.g. an assembly's per-key configs) whose entries
// are reachable via `.get()` rather than property access.
type ReadableConfig =
  | AnyConfigurationModel
  | IMSTMap<AnyConfigurationSchemaType>

function isConfigMap(
  confObject: ReadableConfig,
): confObject is IMSTMap<AnyConfigurationSchemaType> {
  return isStateTreeNode(confObject) && isMapType(getType(confObject))
}

// Read a slot's raw stored value, drilling into a map entry via `.get()` when
// the config is itself a types.map.
function rawSlotValue(confObject: ReadableConfig, slotName: string) {
  return isConfigMap(confObject)
    ? confObject.get(slotName)
    : confObject[slotName]
}

// Read and resolve a single slot: raw value, jexl callback evaluation, then a
// referentially-stable snapshot for sub-config nodes.
function readSlot(
  confObject: ReadableConfig,
  slotName: string,
  args: Record<string, unknown>,
) {
  // strict undefined check, not truthiness — a slot value can legitimately be
  // falsy (0, '', false, null)
  const value = rawSlotValue(confObject, slotName)
  if (value === undefined) {
    return undefined
  }
  const val = isCallbackValue(value)
    ? evalConfigCallback(value, args, confObject)
    : value
  // Fast path for primitives (most common case)
  if (val === null || typeof val !== 'object') {
    return val
  }
  // Return the live, referentially-stable snapshot (frozen in dev) rather than
  // a per-read clone: stable identity lets downstream computeds memoize, and
  // the old structuredClone was both a hot-path allocation and a source of
  // spurious recomputation. Treat as read-only.
  return isStateTreeNode(val) ? getSnapshot(val) : val
}

/**
 * #api core/configuration
 * Given a configuration model (an instance of a ConfigurationSchema), read the
 * configuration value at the given path. Use this when you hold the
 * configuration model directly, e.g. an entry from `session.tracks`.
 *
 * @param model - instance of ConfigurationSchema
 * @param slotPaths - array of paths to read
 * @param args - extra arguments e.g. for a feature callback,
 *  will be sent to each of the slotNames
 */
export function readConfObject<
  CONFMODEL extends AnyConfigurationModel,
  SLOT extends
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
    | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  confObject: CONFMODEL,
  slotPath?: SLOT,
  args?: Record<string, unknown>,
): SLOT extends string
  ? ConfigurationSlotValue<ConfigurationSchemaForModel<CONFMODEL>, SLOT>
  : any
// A top-level config can itself be a types.map of sub-schemas (e.g. an
// assembly's per-key configs); rawSlotValue falls back to map.get() for these.
// The map node lacks the schema model's actions, so it needs its own overload.
export function readConfObject(
  confObject: IMSTMap<AnyConfigurationSchemaType>,
  slotPath?: string | string[],
  args?: Record<string, unknown>,
): any
// loose implementation signature: the body returns values that are `any` by
// nature (raw slot values, snapshots); the typed overload above is what callers
// see.
export function readConfObject(
  confObject: ReadableConfig,
  slotPath?: string | string[],
  args: Record<string, unknown> = {},
): any {
  if (!slotPath) {
    // the whole config as a plain object: the live, referentially-stable
    // snapshot (frozen in dev), not a fresh clone — treat as read-only
    return isStateTreeNode(confObject) ? getSnapshot(confObject) : confObject
  } else if (typeof slotPath === 'string') {
    return readSlot(confObject, slotPath, args)
  } else if (Array.isArray(slotPath)) {
    const slotName = slotPath[0]!
    if (slotPath.length > 1) {
      const subConf = rawSlotValue(confObject, slotName)
      return subConf === undefined
        ? undefined
        : readConfObject(subConf, slotPath.slice(1), args)
    }
    return readSlot(confObject, slotName, args)
  }
  throw new TypeError('slotPath must be a string or array')
}

/**
 * Get a plain-object snapshot of a configuration model that includes ALL
 * values, even defaults. Unlike getSnapshot() which strips default values
 * via postProcessSnapshot, this returns every slot's current value so the
 * result can be sent to an RPC worker as a self-contained config object.
 *
 * For JEXL callback slots, the raw "jexl:..." string is included so the
 * worker can evaluate it per-feature.
 *
 * Note: only handles slots and direct sub-configuration models. Arrays or
 * maps of sub-schemas are silently dropped — no current consumer
 * (LinearBasicDisplay.rpcProps is the only caller) needs them.
 */
export function getConfSnapshot(confObject: AnyConfigurationModel) {
  const result: Record<string, unknown> = {}
  const table = getConfigurationSchemaMetadata(getType(confObject))?.definition
  for (const [key, def] of Object.entries(table ?? {})) {
    const v = confObject[key]
    if (isSlotDefinitionEntry(def)) {
      // jexl callback strings pass through raw for per-feature evaluation in
      // the worker.
      result[key] = isStateTreeNode(v) ? getSnapshot(v) : v
    } else if (
      isConfigurationSchemaType(def) &&
      !isArrayType(def) &&
      !isMapType(def) &&
      isConfigurationModel(v)
    ) {
      // a direct sub-configuration recurses. Arrays/maps of sub-schemas are
      // dropped: their MST node also reports as a config model, but the
      // array/map type carries no registered slot table, so recursing would
      // emit a meaningless `{}` (a type-confusion hazard for a consumer
      // expecting the array). No current caller (rpcProps) needs them.
      // Constants are skipped entirely.
      result[key] = getConfSnapshot(v)
    }
  }
  return result
}

/**
 * #api core/configuration
 * Reads a configuration value from a state model that has a `.configuration`
 * member (a track or display state model). For a raw configuration model, use
 * `readConfObject` instead.
 *
 * @param model - object containing a 'configuration' member
 * @param slotPaths - array of paths to read
 * @param args - extra arguments e.g. for a feature callback,
 *   will be sent to each of the slotNames
 */
export function getConf<
  CONFMODEL extends AnyConfigurationModel,
  SLOT extends
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
    | string[] = ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  model: { configuration: CONFMODEL },
  slotPath?: SLOT,
  args: Record<string, unknown> = {},
): SLOT extends string
  ? ConfigurationSlotValue<ConfigurationSchemaForModel<CONFMODEL>, SLOT>
  : any {
  return readConfObject(model.configuration, slotPath, args)
}

/**
 * given a union of explicitly typed configuration schema types,
 * extract an array of the type names contained in the union
 *
 * @param unionType -
 * @returns Array of type names contained in the union
 */
export function getTypeNamesFromExplicitlyTypedUnion(maybeUnionType: unknown) {
  if (isType(maybeUnionType)) {
    const resolved = resolveLateType(maybeUnionType)
    if (isUnionType(resolved)) {
      const typeNames: string[] = []
      for (const subType of getUnionSubTypes(resolved)) {
        const resolvedSub = resolveLateType(subType)
        // a nested union contributes its own names; otherwise the subtype is a
        // single explicitly-typed schema whose name is its default's `type`
        const nested = getTypeNamesFromExplicitlyTypedUnion(resolvedSub)
        if (nested.length) {
          typeNames.push(...nested)
        } else {
          const typeName = getDefaultValue(resolvedSub).type
          if (!typeName) {
            throw new Error(`invalid config schema type ${resolvedSub}`)
          }
          typeNames.push(typeName)
        }
      }
      return typeNames
    }
  }
  return []
}

export function isBareConfigurationSchemaType(
  thing: unknown,
): thing is AnyConfigurationSchemaType {
  if (isType(thing)) {
    if (isModelType(thing) && isRegisteredConfigurationSchema(thing)) {
      return true
    }
    // if it's a late type, assume its a config schema
    if (isLateType(thing)) {
      return true
    }
  }
  return false
}

export function isConfigurationSchemaType(
  thing: unknown,
): thing is AnyConfigurationSchemaType {
  // written as a series of if-statements instead of a big logical because this
  // construction gives much better debugging backtraces.

  // also, note that the order of these statements matters, because for example
  // some union types are also optional types

  if (!isType(thing)) {
    return false
  } else if (isBareConfigurationSchemaType(thing)) {
    return true
  } else if (isUnionType(thing)) {
    return getUnionSubTypes(thing).every(
      t => isConfigurationSchemaType(t) || t.name === 'undefined',
    )
  } else if (
    isOptionalType(thing) &&
    isConfigurationSchemaType(getSubType(thing))
  ) {
    return true
  } else if (
    isArrayType(thing) &&
    isConfigurationSchemaType(getSubType(thing))
  ) {
    return true
  } else if (isMapType(thing) && isConfigurationSchemaType(getSubType(thing))) {
    return true
  } else {
    return false
  }
}

/**
 * A configuration schema definition maps each key to exactly one of three kinds
 * of entry. Together with `isConfigurationSchemaType` (the sub-schema case),
 * these predicates are the single source of truth for that classification —
 * shared by schema construction and every reader, so "what kind of entry is
 * this?" has one answer everywhere.
 *
 *  - constant   → a bare string/number (becomes a volatile instance constant)
 *  - slot       → a ConfigSlotDefinition object (has a `type` field, not a type)
 *  - sub-schema → an MST configuration-schema type, see isConfigurationSchemaType
 */
export function isConstantEntry(def: unknown): def is string | number {
  return typeof def === 'string' || typeof def === 'number'
}

export function isSlotDefinitionEntry(
  def: unknown,
): def is ConfigSlotDefinition {
  return (
    typeof def === 'object' && def !== null && !isType(def) && 'type' in def
  )
}

export function isConfigurationModel(
  thing: unknown,
): thing is AnyConfigurationModel {
  return isStateTreeNode(thing) && isConfigurationSchemaType(getType(thing))
}

function resolveConfigValue(
  config: Record<string, unknown>,
  key: string | string[],
) {
  if (Array.isArray(key)) {
    let val: unknown = config
    for (const k of key) {
      val = (val as Record<string, unknown> | null | undefined)?.[k]
    }
    return val
  }
  return config[key]
}

/**
 * Read a value from a plain config snapshot object. Automatically evaluates
 * "jexl:..." strings per-feature. Works without MST — intended for use in
 * rendering code (GPU, Canvas2D, workers). Pass the worker pluginManager's jexl
 * instance to make plugin-registered jexl functions available (e.g. a custom
 * `mouseover` slot); omit it to use the default instance.
 */
export function readConfigValue<T>(
  config: Record<string, unknown>,
  key: string | string[],
  feature: Feature,
  jexl?: JexlInstance,
) {
  const raw = resolveConfigValue(config, key)
  return (
    isCallbackValue(raw) ? evaluateJexl(raw, { feature }, jexl) : raw
  ) as T
}
