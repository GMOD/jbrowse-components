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
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from './configurationSchema'
import {
  getUnionSubTypes,
  getDefaultValue,
  getSubType,
  resolveLateType,
} from '../util/mst-reflection'

/**
 * given a configuration model (an instance of a ConfigurationSchema),
 * read the configuration variable at the given path
 *
 * @param {object} model instance of ConfigurationSchema
 * @param {array} slotPaths array of paths to read
 * @param {any} args extra arguments e.g. for a feature callback,
 *  will be sent to each of the slotNames
 */
export function readConfObject(
  confObject: AnyConfigurationModel,
  slotPath: string[] | string | undefined = undefined,
  args: unknown[] = [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (!confObject) throw new TypeError('must provide conf object to read')
  if (!slotPath) return getSnapshot(confObject)
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
      // instead of returning undefine
      //
      // const modelType = getType(model)
      // const schemaType = model.configuration && getType(model.configuration)
      // throw new Error(
      //   `no slot "${slotName}" found in ${modelType.name} configuration (${
      //     schemaType.name
      //   })`,
      // )
    }
    if (slot.func) {
      const appliedFunc = slot.func.apply(null, args)
      if (isStateTreeNode(appliedFunc)) return getSnapshot(appliedFunc)
      return appliedFunc
    }
    if (isStateTreeNode(slot)) return getSnapshot(slot)
    return slot
  }

  const slotName = slotPath[0]
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
    if (!subConf) {
      return undefined
    }
    return readConfObject(subConf, newPath, args)
  }
  return readConfObject(confObject, slotName, args)
}

/**
 * helper method for readConfObject, reads the config from a mst model
 *
 * @param {object} model object containing a 'configuration' member
 * @param {array} slotPaths array of paths to read
 * @param {any} args extra arguments e.g. for a feature callback,
 *   will be sent to each of the slotNames
 */
type ThingWithConfigurationMember = { configuration: unknown }
export function getConf(
  model: unknown,
  slotName: string | string[],
  args: unknown[] = [],
) {
  if (!model) throw new TypeError('must provide a model object')
  const { configuration } = model as ThingWithConfigurationMember
  if (isConfigurationModel(configuration)) {
    return readConfObject(configuration, slotName, args)
  }
  throw new TypeError('cannot getConf on this model, it has no configuration')
}

/**
 * given a union of explicitly typed configuration schema types,
 * extract an array of the type names contained in the union
 *
 * @param {mst union type} unionType
 * @returns {Array[string]} type names contained in the union
 */
export function getTypeNamesFromExplicitlyTypedUnion(maybeUnionType: unknown) {
  if (isType(maybeUnionType)) {
    maybeUnionType = resolveLateType(maybeUnionType)
    // @ts-ignore
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
    if (isLateType(thing)) return true
  }
  return false
}

export function isConfigurationSchemaType(thing: unknown): boolean {
  if (!isType(thing)) return false

  // written as a series of if-statements instead of a big logical OR
  // because this construction gives much better debugging backtraces.

  // also, note that the order of these statements matters, because
  // for example some union types are also optional types

  if (isBareConfigurationSchemaType(thing)) return true

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
