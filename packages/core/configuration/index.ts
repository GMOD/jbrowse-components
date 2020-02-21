import {
  isStateTreeNode,
  getPropertyMembers,
  getSnapshot,
  getType,
  isMapType,
} from 'mobx-state-tree'

import {
  ConfigurationSchema,
  ConfigurationReference,
  ConfigurationModel,
} from './configurationSchema'

// function getModelConfig(tree) {
//   // if this is a node
//   if (isStateTreeNode(tree)) {
//     let config
//     if (isObservableObject(tree)) {
//       let keys
//       //   if it has a 'configuration' view, use that as the node instead
//       //   otherwise, just recurse through it normally
//       if (tree.configuration) {
//         tree = tree.configuration
//         keys = Object.keys(tree)
//       } else {
//         keys = Object.keys(getPropertyMembers(tree).properties)
//       }
//       config = {}
//       keys.forEach(key => {
//         config[key] = getModelConfig(tree[key])
//       })
//     } else if (isObservableArray(tree)) config = tree.map(getModelConfig)
//     else if (isObservableMap(tree)) {
//       config = {}
//       tree.forEach((value, key) => {
//         config[key] = getModelConfig(value)
//       })
//     }

//     return config
//   }
//   return tree
// }

/**
 * given a configuration model (an instance of a ConfigurationSchema),
 * read the configuration variable at the given path
 *
 * @param {object} model instance of ConfigurationSchema
 * @param {array} slotPaths array of paths to read
 * @param {any} args extra arguments e.g. for a feature callback,
 *  will be sent to each of the slotNames
 */
function readConfObject(
  confObject: ConfigurationModel,
  slotPath: string[] | string,
  args: any[] = [],
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
 * @param {object} model instance of ConfigurationSchema
 * @param {array} slotPaths array of paths to read
 * @param {any} args extra arguments e.g. for a feature callback,
 *   will be sent to each of the slotNames
 */
function getConf(model, slotName, args = []) {
  if (!model) throw new TypeError('must provide a model object')
  if (!model.configuration) {
    throw new TypeError('cannot getConf on this model, it has no configuration')
  }
  return readConfObject(model.configuration, slotName, args)
}

export { ConfigurationSchema, ConfigurationReference, getConf, readConfObject }
