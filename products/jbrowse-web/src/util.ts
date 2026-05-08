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

export {
  b64PadSuffix,
  fromUrlSafeB64,
  toUrlSafeB64,
} from '@jbrowse/core/util'

type MSTArray = Instance<ReturnType<typeof types.array>>
type MSTMap = Instance<ReturnType<typeof types.map>>

// attempts to remove undefined references from the given MST model. can only
// actually remove them from arrays and maps. throws MST undefined ref error if
// it encounters undefined refs in model properties
export function filterSessionInPlace(node: IAnyStateTreeNode, type: IAnyType) {
  // makes it work with session sharing

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
    // eslint-disable-next-line unicorn/no-array-for-each
    array.forEach(el => {
      filterSessionInPlace(el, childType)
    })
  } else if (isMapType(type)) {
    const map = node as MSTMap
    const childType = getChildType(map)
    if (isReferenceType(childType)) {
      // filter the map members
      for (const key of map.keys()) {
        if (!isValidReference(() => map.get(key))) {
          map.delete(key)
        }
      }
    }
    // eslint-disable-next-line unicorn/no-array-for-each
    map.forEach(child => {
      filterSessionInPlace(child, childType)
    })
  } else if (isModelType(type)) {
    // iterate over children
    const { properties } = getPropertyMembers(node)

    // eslint-disable-next-line unicorn/no-array-for-each
    Object.entries(properties).forEach(([pname, ptype]) => {
      filterSessionInPlace(node[pname], ptype)
    })
  }
}

export function addRelativeUris(
  config: Record<string, unknown> | null,
  base: URL,
) {
  if (typeof config === 'object' && config !== null) {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === 'object' && config[key] !== null) {
        addRelativeUris(config[key] as Record<string, unknown>, base)
      } else if (key === 'uri') {
        config.baseUri = config.baseUri ?? base.href
      }
    }
  }
}

// raw readConf alternative for before conf is initialized
export function readConf(
  root: Record<string, unknown> | undefined,
  attr: string,
  def: string,
) {
  const configuration = root?.configuration as
    | Record<string, unknown>
    | undefined
  return configuration?.[attr] ?? def
}

export { checkPlugins, fetchPlugins } from './checkPlugins.ts'

export function removeAttr(obj: Record<string, unknown>, attr: string) {
  for (const prop in obj) {
    if (prop === attr) {
      delete obj[prop]
    } else if (typeof obj[prop] === 'object' && obj[prop] !== null) {
      removeAttr(obj[prop] as Record<string, unknown>, attr)
    }
  }
  return obj
}

export const reloadPage = () => {
  window.location.reload()
}
