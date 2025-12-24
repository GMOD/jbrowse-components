import {
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
import { untracked } from 'mobx'

import {
  getDefaultValue,
  getSubType,
  getUnionSubTypes,
  resolveLateType,
} from '../util/mst-reflection'

import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
} from './types'

// Cache for config snapshots to avoid repeated MST traversal in webworker context
// WeakMap ensures configs can be garbage collected
const snapshotCache = new WeakMap<AnyConfigurationModel, any>()

// Value cache: caches the final resolved values to avoid re-reading
// Key structure: confObject -> Map<slotPath, {value, hasArgs}>
const valueCache = new WeakMap<
  AnyConfigurationModel,
  Map<string, { value: any; hasArgs: boolean }>
>()

// Slot cache: caches the expr objects for callbacks
// This allows us to skip MST navigation and slot.expr getter overhead
// Stores {expr, isConfig} where expr is the cached expression object
const slotCache = new WeakMap<
  AnyConfigurationModel,
  Map<string, { expr: any; isConfig: boolean }>
>()

// Debug counters - track both cumulative and window stats
let cacheHits = 0
let cacheMisses = 0
let valueCacheHits = 0
let valueCacheMisses = 0
let slotCacheHits = 0
let slotCacheMisses = 0
let untrackedReads = 0
let trackedReads = 0
let lastLogTime = 0

// Snapshot counters for computing rates over a window
let lastCacheHits = 0
let lastCacheMisses = 0
let lastValueCacheHits = 0
let lastValueCacheMisses = 0
let lastSlotCacheHits = 0
let lastSlotCacheMisses = 0
let lastUntrackedReads = 0
let lastTrackedReads = 0

function logDebugStats() {
  const now = Date.now()
  if (now - lastLogTime > 5000) {
    // Calculate deltas for this window
    const deltaUntrackedReads = untrackedReads - lastUntrackedReads
    const deltaTrackedReads = trackedReads - lastTrackedReads
    const deltaTotalReads = deltaUntrackedReads + deltaTrackedReads

    const deltaSnapshotHits = cacheHits - lastCacheHits
    const deltaSnapshotMisses = cacheMisses - lastCacheMisses
    const deltaSnapshotTotal = deltaSnapshotHits + deltaSnapshotMisses

    const deltaValueHits = valueCacheHits - lastValueCacheHits
    const deltaValueMisses = valueCacheMisses - lastValueCacheMisses
    const deltaValueTotal = deltaValueHits + deltaValueMisses

    const deltaSlotHits = slotCacheHits - lastSlotCacheHits
    const deltaSlotMisses = slotCacheMisses - lastSlotCacheMisses
    const deltaSlotTotal = deltaSlotHits + deltaSlotMisses

    console.log('[readConfObject] Stats (recent window):', {
      totalReads: deltaTotalReads,
      snapshotHitRate: (deltaSnapshotHits / deltaSnapshotTotal || 0).toFixed(3),
      valueHitRate: (deltaValueHits / deltaValueTotal || 0).toFixed(3),
      slotHitRate: (deltaSlotHits / deltaSlotTotal || 0).toFixed(3),
      percentUntracked:
        ((deltaUntrackedReads / deltaTotalReads) * 100 || 0).toFixed(1) + '%',
      breakdown: {
        snapshotHits: deltaSnapshotHits,
        valueHits: deltaValueHits,
        slotHits: deltaSlotHits,
        misses: deltaSnapshotMisses,
      },
    })

    // Save current values for next window
    lastCacheHits = cacheHits
    lastCacheMisses = cacheMisses
    lastValueCacheHits = valueCacheHits
    lastValueCacheMisses = valueCacheMisses
    lastSlotCacheHits = slotCacheHits
    lastSlotCacheMisses = slotCacheMisses
    lastUntrackedReads = untrackedReads
    lastTrackedReads = trackedReads
    lastLogTime = now
  }
}

function getCachedSnapshot(confObject: AnyConfigurationModel): any {
  // only cache if it's actually an MST node
  if (!isStateTreeNode(confObject)) {
    return confObject
  }

  let snapshot = snapshotCache.get(confObject)
  if (!snapshot) {
    snapshot = getSnapshot(confObject)
    snapshotCache.set(confObject, snapshot)
  }
  return snapshot
}

/**
 * given a configuration model (an instance of a ConfigurationSchema),
 * read the configuration variable at the given path
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
  logDebugStats()

  if (!slotPath) {
    untrackedReads++
    return JSON.parse(JSON.stringify(getCachedSnapshot(confObject)))
  } else if (typeof slotPath === 'string') {
    const hasArgs = Object.keys(args).length > 0

    // Try slot cache first for callbacks with args
    // Check cache before isStateTreeNode to avoid MobX overhead
    if (hasArgs) {
      const objSlotCache = slotCache.get(confObject)
      if (objSlotCache) {
        const cached = objSlotCache.get(slotPath)
        if (cached && !cached.isConfig) {
          // Fast path: we have the expr cached, just evaluate it
          // Eval in untracked in case the jexl expression accesses MST properties
          slotCacheHits++
          untrackedReads++
          const val = untracked(() => cached.expr.eval(args))
          // Fast path for primitives (strings, numbers, booleans)
          // Most label colors/names are primitives, avoid any MobX checks
          if (val === null || val === undefined) {
            return val
          }
          const valType = typeof val
          if (
            valType === 'string' ||
            valType === 'number' ||
            valType === 'boolean'
          ) {
            return val
          }
          // For objects, avoid isStateTreeNode (triggers MobX) and use try/catch
          // Most callback results are primitives anyway
          try {
            return JSON.parse(JSON.stringify(val))
          } catch {
            // If stringify fails, it might be a complex object, fall back
            return untracked(() =>
              isStateTreeNode(val)
                ? JSON.parse(JSON.stringify(getSnapshot(val)))
                : val,
            )
          }
        }
      }
    }

    // Try value cache for non-callback values
    // Check cache before isStateTreeNode to avoid MobX overhead
    const objCache = valueCache.get(confObject)
    if (objCache) {
      const cached = objCache.get(slotPath)
      // Use cached value if: it exists AND (!hasArgs OR cached value is not a callback)
      if (cached && (!hasArgs || !cached.hasArgs)) {
        valueCacheHits++
        untrackedReads++
        return typeof cached.value === 'object' && cached.value !== null
          ? JSON.parse(JSON.stringify(cached.value))
          : cached.value
      }
    }

    // optimization: try reading from cached snapshot first to avoid MST property access
    // only fall back to MST access for callbacks or if snapshot doesn't have the value
    if (isStateTreeNode(confObject)) {
      const snapshot = getCachedSnapshot(confObject)
      const snapshotValue = snapshot[slotPath]

      // check if this looks like a jexl callback that needs evaluation
      const needsEval =
        typeof snapshotValue === 'string' && snapshotValue.startsWith('jexl:')

      if (needsEval && hasArgs) {
        // Fast path for callbacks with args: skip MST navigation, evaluate directly
        // Get the slot in untracked mode and evaluate the callback
        cacheHits++
        trackedReads++
        return untracked(() => {
          const slot = confObject[slotPath]
          if (slot?.expr) {
            const val = slot.expr.eval(args)
            return isStateTreeNode(val)
              ? JSON.parse(JSON.stringify(getSnapshot(val)))
              : val
          }
          return undefined
        })
      } else if (!needsEval && snapshotValue !== undefined) {
        // fast path: return snapshot value directly (no MST access, no JSON.parse/stringify)
        cacheHits++
        untrackedReads++
        const result =
          typeof snapshotValue === 'object' && snapshotValue !== null
            ? JSON.parse(JSON.stringify(snapshotValue))
            : snapshotValue

        // Store in value cache for next time (not a callback, so args don't matter)
        let objCache = valueCache.get(confObject)
        if (!objCache) {
          objCache = new Map()
          valueCache.set(confObject, objCache)
        }
        objCache.set(slotPath, { value: snapshotValue, hasArgs: false })

        return result
      }
    }

    // slow path: need to access MST for callbacks or missing values
    // Use untracked() to prevent MobX from tracking these reads, which is expensive
    cacheMisses++
    valueCacheMisses++
    slotCacheMisses++
    trackedReads++

    let isCallback = false
    let slot: any = null
    const result = untracked(() => {
      slot = confObject[slotPath]
      if (!slot) {
        return undefined
      }

      // Check if slot is a config slot (has .value) or a sub-configuration/primitive
      if (slot && typeof slot === 'object' && 'value' in slot) {
        // For config slots: try getSnapshot first to avoid MobX property access
        // Note: postProcessSnapshot returns the value directly (or undefined for defaults)
        let slotValue
        try {
          const slotSnapshot = getSnapshot(slot)
          // If snapshot is undefined, it means the value is the default - need to read from MST
          slotValue = slotSnapshot !== undefined ? slotSnapshot : slot.value
        } catch {
          // If getSnapshot fails, fall back to direct access
          slotValue = slot.value
        }

        if (typeof slotValue === 'string' && slotValue.startsWith('jexl:')) {
          // It's a callback - need to use slot.expr to evaluate it
          isCallback = true
          const val = slot.expr.eval(args)
          return isStateTreeNode(val)
            ? JSON.parse(JSON.stringify(getSnapshot(val)))
            : val
        }
        // Not a callback - return the value directly
        return typeof slotValue === 'object' && slotValue !== null
          ? JSON.parse(JSON.stringify(slotValue))
          : slotValue
      }
      // It's a sub-configuration or primitive value, return as-is
      return isStateTreeNode(slot)
        ? JSON.parse(JSON.stringify(getSnapshot(slot)))
        : slot
    })

    // Cache the expr object if it's a callback - next time we can skip all MST access
    if (isCallback && slot && isStateTreeNode(confObject)) {
      let objSlotCache = slotCache.get(confObject)
      if (!objSlotCache) {
        objSlotCache = new Map()
        slotCache.set(confObject, objSlotCache)
      }
      // Read slot.expr once in untracked mode and cache the expr object itself
      const expr = untracked(() => slot.expr)
      objSlotCache.set(slotPath, { expr, isConfig: false })
    }

    // Store in value cache - skip only for callbacks or nested config objects
    if (!isCallback && !isStateTreeNode(result) && isStateTreeNode(confObject)) {
      let objCache = valueCache.get(confObject)
      if (!objCache) {
        objCache = new Map()
        valueCache.set(confObject, objCache)
      }
      // Mark hasArgs = false for static values
      objCache.set(slotPath, { value: result, hasArgs: false })
    }

    return result
  } else if (Array.isArray(slotPath)) {
    const slotName = slotPath[0]!
    if (slotPath.length > 1) {
      const newPath = slotPath.slice(1)

      // Try to get cached sub-config first - check cache before isStateTreeNode
      const objSlotCache = slotCache.get(confObject)
      if (objSlotCache) {
        const cached = objSlotCache.get(slotName)
        if (cached && cached.isConfig) {
          // Fast path: we have the sub-config cached
          slotCacheHits++
          return readConfObject(cached.expr, newPath, args)
        }
      }

      // Try to navigate through snapshot to avoid MST access
      if (isStateTreeNode(confObject)) {
        const snapshot = getCachedSnapshot(confObject)
        const snapshotValue = snapshot[slotName]

        // If snapshot has the nested config, read from it recursively
        if (snapshotValue !== undefined && typeof snapshotValue === 'object') {
          cacheHits++
          return readConfObject(snapshotValue as any, newPath, args)
        }
      }

      // Slow path: need to access MST to get sub-configuration
      // Use untracked() to prevent MobX from tracking these reads
      cacheMisses++
      slotCacheMisses++
      trackedReads++

      // Navigate to sub-config in untracked mode
      const subConf = untracked(() => confObject[slotName])

      // Cache the sub-config for next time (use expr field for the config, isConfig=true)
      if (subConf && isStateTreeNode(confObject)) {
        let objSlotCache = slotCache.get(confObject)
        if (!objSlotCache) {
          objSlotCache = new Map()
          slotCache.set(confObject, objSlotCache)
        }
        objSlotCache.set(slotName, { expr: subConf, isConfig: true })
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
 * helper method for readConfObject, reads the config from a mst model
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
  const { configuration } = model
  if (isConfigurationModel(configuration)) {
    return readConfObject<CONFMODEL>(configuration, slotPath, args)
  }
  throw new TypeError('cannot getConf on this model, it has no configuration')
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
    maybeUnionType = resolveLateType(maybeUnionType)
    // @ts-expect-error
    if (isUnionType(maybeUnionType)) {
      const typeNames: string[] = []
      for (let type of getUnionSubTypes(maybeUnionType)) {
        type = resolveLateType(type)
        let typeName = getTypeNamesFromExplicitlyTypedUnion(type)
        if (!typeName.length) {
          const def = getDefaultValue(type)
          typeName = [def.type]
        }
        if (!typeName[0]) {
          // debugger
          throw new Error(`invalid config schema type ${type}`)
        }
        typeNames.push(...typeName)
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

export function isConfigurationModel(
  thing: unknown,
): thing is AnyConfigurationModel {
  return isStateTreeNode(thing) && isConfigurationSchemaType(getType(thing))
}

export function isConfigurationSlotType(thing: unknown) {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'isJBrowseConfigurationSlot' in thing
  )
}
