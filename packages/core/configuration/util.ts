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

interface ConfigSlot {
  getValue: (args: Record<string, unknown>) => unknown
}

// confObject[slotPath] can return:
// - a config slot model (has getValue method)
// - a sub-configuration object (nested config schema)
// - a primitive value (string, number, etc.)
// - undefined/null
function isConfigSlot(slot: unknown): slot is ConfigSlot {
  return typeof (slot as ConfigSlot)?.getValue === 'function'
}

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
  if (!slotPath) {
    // Handle both MST nodes and plain objects
    return isStateTreeNode(confObject)
      ? structuredClone(getSnapshot(confObject))
      : structuredClone(confObject)
  } else if (typeof slotPath === 'string') {
    // slot can be a config slot model, sub-configuration, primitive, or undefined
    let slot: unknown = confObject[slotPath]
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
      const val = isConfigSlot(slot) ? slot.getValue(args) : slot
      return isStateTreeNode(val)
        ? JSON.parse(JSON.stringify(getSnapshot(val)))
        : val
    }
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
