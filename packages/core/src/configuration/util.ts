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

import { evaluateJexl, isCallbackValue } from './slotValueUtils.ts'
import {
  getDefaultValue,
  getSubType,
  getUnionSubTypes,
  resolveLateType,
} from '../util/mst-reflection.ts'

import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
} from './types.ts'
import type { Feature } from '../util/index.ts'
import type { JexlInstance } from '../util/jexlStrings.ts'

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
export function readConfObject<CONFMODEL extends AnyConfigurationModel>(
  confObject: CONFMODEL,
  slotPath?:
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>
    | string[],
  args: Record<string, unknown> = {},
): any {
  if (!slotPath) {
    // Handle both MST nodes and plain objects
    return isStateTreeNode(confObject)
      ? structuredClone(getSnapshot(confObject))
      : structuredClone(confObject)
  } else if (typeof slotPath === 'string') {
    // slot value, sub-configuration node, primitive, or undefined. Use a strict
    // undefined check, not truthiness — a slot value can legitimately be falsy
    // (0, '', false, null).
    let value: unknown = confObject[slotPath]
    if (value === undefined) {
      // check for the subconf being a map if we don't find it immediately
      if (isStateTreeNode(confObject) && isMapType(getType(confObject))) {
        value = confObject.get(slotPath)
      }
      if (value === undefined) {
        return undefined
      }
    }
    const val = isCallbackValue(value)
      ? evalConfigCallback(value, args, confObject)
      : value
    // Fast path for primitives (most common case)
    if (val === null || typeof val !== 'object') {
      return val
    }
    // Clone to prevent mutation of config state
    return structuredClone(isStateTreeNode(val) ? getSnapshot(val) : val)
  } else if (Array.isArray(slotPath)) {
    const slotName = slotPath[0]!
    if (slotPath.length > 1) {
      const newPath = slotPath.slice(1)
      let subConf = confObject[slotName]
      // check for the subconf being a map if we don't find it immediately
      if (
        !subConf &&
        isStateTreeNode(confObject) &&
        isMapType(getType(confObject))
      ) {
        subConf = confObject.get(slotName)
      }
      return subConf ? readConfObject(subConf, newPath, args) : undefined
    }
    return readConfObject(
      confObject,
      slotName as ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
      args,
    )
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
  const table = (
    getType(confObject) as {
      jbrowseSchemaDefinition?: Record<string, unknown>
    }
  ).jbrowseSchemaDefinition
  for (const [key, def] of Object.entries(table ?? {})) {
    // skip constants (string/number entries in the schema definition)
    if (typeof def !== 'object' || def === null) {
      continue
    }
    const v = confObject[key]
    if (isConfigurationModel(v)) {
      result[key] = getConfSnapshot(v)
    } else if (!isType(def)) {
      // a slot (def is a ConfigSlotDefinition plain object). jexl callback
      // strings pass through raw for per-feature evaluation in the worker.
      // arrays/maps of sub-schemas (def is an MST type) are intentionally
      // dropped — no current caller needs them.
      result[key] = isStateTreeNode(v) ? getSnapshot(v) : v
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
export function getConf<CONFMODEL extends AnyConfigurationModel>(
  model: { configuration: CONFMODEL },
  slotPath?: Parameters<typeof readConfObject<CONFMODEL>>[1],
  args?: Parameters<typeof readConfObject<CONFMODEL>>[2],
) {
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
        let typeName = getTypeNamesFromExplicitlyTypedUnion(resolvedSub)
        if (!typeName.length) {
          const def = getDefaultValue(resolvedSub)
          typeName = [def.type]
        }
        if (!typeName[0]) {
          throw new Error(`invalid config schema type ${resolvedSub}`)
        }
        for (const name of typeName) {
          typeNames.push(name)
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
    if (
      isModelType(thing) &&
      ('isJBrowseConfigurationSchema' in thing ||
        thing.name.includes('ConfigurationSchema'))
    ) {
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

// Cache for isConfigurationModel results to avoid expensive repeated type checks
const configurationModelCache = new WeakMap<object, boolean>()

export function isConfigurationModel(
  thing: unknown,
): thing is AnyConfigurationModel {
  if (!thing || typeof thing !== 'object') {
    return false
  }
  let cached = configurationModelCache.get(thing)
  if (cached === undefined) {
    cached = isStateTreeNode(thing) && isConfigurationSchemaType(getType(thing))
    configurationModelCache.set(thing, cached)
  }
  return cached
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
 * rendering code (GPU, Canvas2D, workers).
 */
export function readConfigValue<T>(
  config: Record<string, unknown>,
  key: string | string[],
  feature: Feature,
) {
  const raw = resolveConfigValue(config, key)
  return (isCallbackValue(raw) ? evaluateJexl(raw, { feature }) : raw) as T
}
