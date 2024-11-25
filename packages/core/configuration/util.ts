import {
  isStateTreeNode,
  getSnapshot,
  getType,
  isMapType,
  isType,
  isUnionType,
  isOptionalType,
  isArrayType,
  isModelType,
  isLateType,
} from 'mobx-state-tree'

import {
  getUnionSubTypes,
  getDefaultValue,
  getSubType,
  resolveLateType,
} from '../util/mst-reflection'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  ConfigurationSlotName,
  ConfigurationSchemaForModel,
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
    return JSON.parse(JSON.stringify(getSnapshot(confObject)))
  }
  if (typeof slotPath === 'string') {
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
    }

    const val = slot.expr ? slot.expr.evalSync(args) : slot
    return isStateTreeNode(val)
      ? JSON.parse(JSON.stringify(getSnapshot(val)))
      : val
  }

  if (Array.isArray(slotPath)) {
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
      getUnionSubTypes(maybeUnionType).forEach(type => {
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
      })
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
  if (!isType(thing)) {
    return false
  }

  // written as a series of if-statements instead of a big logical OR
  // because this construction gives much better debugging backtraces.

  // also, note that the order of these statements matters, because
  // for example some union types are also optional types

  if (isBareConfigurationSchemaType(thing)) {
    return true
  }

  if (isUnionType(thing)) {
    return getUnionSubTypes(thing).every(
      t => isConfigurationSchemaType(t) || t.name === 'undefined',
    )
  }

  if (isOptionalType(thing) && isConfigurationSchemaType(getSubType(thing))) {
    return true
  }

  if (isArrayType(thing) && isConfigurationSchemaType(getSubType(thing))) {
    return true
  }

  if (isMapType(thing) && isConfigurationSchemaType(getSubType(thing))) {
    return true
  }

  return false
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
