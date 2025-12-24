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

// Debug counters
let cacheHits = 0
let cacheMisses = 0
let untrackedReads = 0
let trackedReads = 0
let lastLogTime = 0

function logDebugStats() {
  const now = Date.now()
  if (now - lastLogTime > 5000) {
    console.log('[readConfObject] Stats:', {
      cacheHits,
      cacheMisses,
      cacheHitRate: cacheHits / (cacheHits + cacheMisses) || 0,
      untrackedReads,
      trackedReads,
      untrackedRatio: untrackedReads / (untrackedReads + trackedReads) || 0,
    })
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
    return structuredClone(getCachedSnapshot(confObject))
  } else if (typeof slotPath === 'string') {
    // optimization: try reading from cached snapshot first to avoid MST property access
    // only fall back to MST access for callbacks or if snapshot doesn't have the value
    if (isStateTreeNode(confObject)) {
      const snapshot = getCachedSnapshot(confObject)
      const snapshotValue = snapshot[slotPath]

      // check if this looks like a jexl callback that needs evaluation
      const needsEval =
        typeof snapshotValue === 'string' && snapshotValue.startsWith('jexl:')

      if (!needsEval && snapshotValue !== undefined) {
        // fast path: return snapshot value directly (no MST access, no JSON.parse/stringify)
        cacheHits++
        untrackedReads++
        return typeof snapshotValue === 'object' && snapshotValue !== null
          ? structuredClone(snapshotValue)
          : snapshotValue
      }
    }

    // slow path: need to access MST for callbacks or missing values
    // Use untracked() to prevent MobX from tracking these reads, which is expensive
    cacheMisses++
    return untracked(() => {
      trackedReads++
      let slot = confObject[slotPath]
      // check for the subconf being a map if we don't find it immediately
      if (
        !slot &&
        isStateTreeNode(confObject) &&
        isMapType(getType(confObject))
      ) {
        slot = confObject.get(slotPath)
      }
      if (!slot) {
        return undefined
        // if we want to be very strict about config slots, we could uncomment the below
        // instead of returning undefined
        //
        // const modelType = getType(model)
        // const schemaType = model.configuration && getType(model.configuration)
        // throw new Error(
        //   `no slot "${slotName}" found in ${modelType.name} configuration (${
        //     schemaType.name
        //   })`,
        // )
      } else {
        const val = slot.expr ? slot.expr.eval(args) : slot
        return isStateTreeNode(val)
          ? JSON.parse(JSON.stringify(getCachedSnapshot(val)))
          : val
      }
    })
  } else if (Array.isArray(slotPath)) {
    const slotName = slotPath[0]!
    if (slotPath.length > 1) {
      const newPath = slotPath.slice(1)

      // optimization: try to navigate through snapshot first
      if (isStateTreeNode(confObject)) {
        const snapshot = getCachedSnapshot(confObject)
        const snapshotValue = snapshot[slotName]

        // if snapshot has the nested config, try to read from it recursively
        if (snapshotValue !== undefined && typeof snapshotValue === 'object') {
          // recurse into the snapshot value for nested path
          // note: snapshotValue might not be an MST node, so we need to handle plain objects
          cacheHits++
          return readConfObject(snapshotValue as any, newPath, args)
        }
      }

      // slow path: access MST for missing or callback values
      // Use untracked() to prevent MobX from tracking these reads
      cacheMisses++
      return untracked(() => {
        trackedReads++
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
      })
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
