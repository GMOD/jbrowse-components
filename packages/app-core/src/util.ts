import {
  getChildType,
  getPropertyMembers,
  isArrayType,
  isMapType,
  isModelType,
  isReferenceType,
  isValidReference,
} from '@jbrowse/mobx-state-tree'

import type {
  IAnyStateTreeNode,
  IAnyType,
  Instance,
  types,
} from '@jbrowse/mobx-state-tree'

type MSTArray = Instance<ReturnType<typeof types.array>>
type MSTMap = Instance<ReturnType<typeof types.map>>

/**
 * Attempts to remove undefined references from the given MST model. Can only
 * actually remove them from arrays and maps. Throws MST undefined ref error if
 * it encounters undefined refs in model properties.
 */
export function filterSessionInPlace(node: IAnyStateTreeNode, type: IAnyType) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (node === undefined) {
    return
  }
  if (isArrayType(type)) {
    const array = node as MSTArray
    const childType = getChildType(node)
    if (isReferenceType(childType)) {
      // filter array elements
      for (let i = 0; i < array.length; ) {
        if (!isValidReference(() => array[i])) {
          array.splice(i, 1)
        } else {
          i += 1
        }
      }
    }
    for (const el of array) {
      filterSessionInPlace(el, childType)
    }
  } else if (isMapType(type)) {
    const map = node as MSTMap
    const childType = getChildType(map)
    if (isReferenceType(childType)) {
      // filter the map members
      for (const key in map.keys()) {
        if (!isValidReference(() => map.get(key))) {
          map.delete(key)
        }
      }
    }
    for (const child of map) {
      filterSessionInPlace(child, childType)
    }
  } else if (isModelType(type)) {
    // iterate over children
    const { properties } = getPropertyMembers(node)

    for (const [pname, ptype] of Object.entries(properties)) {
      filterSessionInPlace(node[pname], ptype)
    }
  }
}
