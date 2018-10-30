import {
  isStateTreeNode,
  isModelType,
  getPropertyMembers,
} from 'mobx-state-tree'

import { isObservableArray, isObservableObject } from 'mobx'

export function getConfig(tree) {
  // if this is a node
  if (isStateTreeNode(tree)) {
    let config
    if (isObservableObject(tree)) {
      let keys
      if (tree.configuration) {
        tree = tree.configuration
        keys = Object.keys(tree)
      } else {
        keys = Object.keys(getPropertyMembers(tree).properties)
      }
      config = {}
      keys.forEach(key => {
        config[key] = getConfig(tree[key])
      })
    } else if (isObservableArray(tree)) {
      config = tree.map(getConfig)
    }

    //   if it has a 'configuration' view, use that as the node instead
    //   otherwise, just recurse through it normally
    return config
  }
  return tree
}

export function fog() {}
