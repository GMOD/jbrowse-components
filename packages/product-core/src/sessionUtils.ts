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

// Walks an MST node cleaning up a freshly-loaded session in place:
// - drops dangling references from arrays/maps
// - drops any array/map element that can't be walked, e.g. an open track whose
//   `configuration` reference resolves to a structurally-invalid config and
//   fails to hydrate. Dropping keeps the invariant that the open set only ever
//   holds usable tracks (matching the open/add paths, which refuse invalid
//   configs), so downstream code never has to defend against a track whose
//   config access throws.
// Used after loading shared sessions where referenced ids may not exist.
export function filterSessionInPlace(node: IAnyStateTreeNode, type: IAnyType) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (node === undefined) {
    return
  }
  if (isArrayType(type)) {
    const array = node as MSTArray
    const childType = getChildType(node)
    const isRef = isReferenceType(childType)
    for (let i = 0; i < array.length; ) {
      if (!walkChildOrDrop(() => array[i], childType, isRef)) {
        array.splice(i, 1)
      } else {
        i += 1
      }
    }
  } else if (isMapType(type)) {
    const map = node as MSTMap
    const childType = getChildType(map)
    const isRef = isReferenceType(childType)
    for (const key of map.keys()) {
      if (!walkChildOrDrop(() => map.get(key), childType, isRef)) {
        map.delete(key)
      }
    }
  } else if (isModelType(type)) {
    const { properties } = getPropertyMembers(node)
    for (const [pname, ptype] of Object.entries(properties)) {
      filterSessionInPlace(node[pname], ptype)
    }
  }
}

// Returns false if the collection element should be dropped: a dangling
// reference, or an element that throws while being walked (unusable). Otherwise
// recurses into it and returns true.
function walkChildOrDrop(
  get: () => IAnyStateTreeNode,
  childType: IAnyType,
  isRef: boolean,
) {
  if (isRef) {
    return isValidReference(get)
  }
  try {
    filterSessionInPlace(get(), childType)
    return true
  } catch (e) {
    console.error(e)
    return false
  }
}

// Walks a JSON config object and stamps a `baseUri` next to every object
// containing a `uri` key, so relative URIs can later be resolved against the
// config's own location.
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
