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

// Walks an MST node and drops undefined references from arrays/maps. Throws
// if it encounters an undefined ref in a non-collection model property
// (those can't be safely removed in place). Used after loading shared
// sessions where some referenced ids may not exist.
export function filterSessionInPlace(node: IAnyStateTreeNode, type: IAnyType) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (node === undefined) {
    return
  }
  if (isArrayType(type)) {
    const array = node as MSTArray
    const childType = getChildType(node)
    if (isReferenceType(childType)) {
      for (let i = 0; i < array.length; ) {
        if (isValidReference(() => array[i])) {
          i += 1
        } else {
          array.splice(i, 1)
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
      for (const key of map.keys()) {
        if (!isValidReference(() => map.get(key))) {
          map.delete(key)
        }
      }
    }
    for (const child of map.values()) {
      filterSessionInPlace(child, childType)
    }
  } else if (isModelType(type)) {
    const { properties } = getPropertyMembers(node)
    for (const [pname, ptype] of Object.entries(properties)) {
      let child
      try {
        child = node[pname]
      } catch (e) {
        // Reading the property threw: e.g. a track's `configuration` reference
        // resolves to a structurally-invalid config and fails to hydrate.
        // Skip it rather than crashing session load — the broken track stays in
        // the session and surfaces as an error in its own track slot (per-track
        // ErrorBoundary) when rendered.
        console.error(e)
        continue
      }
      filterSessionInPlace(child, ptype)
    }
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
