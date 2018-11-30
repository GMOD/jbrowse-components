import {
  isStateTreeNode,
  getPropertyMembers,
  getSnapshot,
  getType,
} from 'mobx-state-tree'
import { isObservableArray, isObservableObject } from 'mobx'

import {
  ConfigurationSchema,
  ConfigurationReference,
} from './configurationSchema'

function getModelConfig(tree) {
  // if this is a node
  if (isStateTreeNode(tree)) {
    let config
    if (isObservableObject(tree)) {
      let keys
      //   if it has a 'configuration' view, use that as the node instead
      //   otherwise, just recurse through it normally
      if (tree.configuration) {
        tree = tree.configuration
        keys = Object.keys(tree)
      } else {
        keys = Object.keys(getPropertyMembers(tree).properties)
      }
      config = {}
      keys.forEach(key => {
        config[key] = getModelConfig(tree[key])
      })
    } else if (isObservableArray(tree)) {
      config = tree.map(getModelConfig)
    }

    return config
  }
  return tree
}

function getConf(model, slotName, args) {
  if (!model.configuration)
    throw new Error(`cannot getConf on this model, it has no configuration`)
  return readConfObject(model.configuration, slotName, args)
}

function readConfObject(confObject, slotName, args) {
  const slot = confObject[slotName]
  if (!slot) {
    return undefined
    // if we want to be very strict about config slots, we could uncomment the below
    // const modelType = getType(model)
    // const schemaType = model.configuration && getType(model.configuration)
    // throw new Error(
    //   `no slot "${slotName}" found in ${modelType.name} configuration (${
    //     schemaType.name
    //   })`,
    // )
  }
  if (slot.func) {
    return slot.func.apply(null, args)
  }
  return getSnapshot(slot)
}

export {
  ConfigurationSchema,
  ConfigurationReference,
  getModelConfig,
  getConf,
  readConfObject,
}
