import {
  isStateTreeNode,
  getSnapshot,
  getType,
  isMapType,
} from 'mobx-state-tree'

import {
  AnyConfigurationModel,
  isConfigurationModel,
} from './configurationSchema'

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
): any {
  if (!model) throw new TypeError('must provide a model object')
  const { configuration } = model as ThingWithConfigurationMember
  if (isConfigurationModel(configuration)) {
    return readConfObject(configuration, slotName, args)
  }
  throw new TypeError('cannot getConf on this model, it has no configuration')
}
