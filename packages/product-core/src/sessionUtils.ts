import {
  getChildType,
  getPropertyMembers,
  getSnapshot,
  getType,
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

// A node dropped from a freshly-loaded session, identified for a user-facing
// message. `configuration` is the (unresolved) trackId; `type` the track type.
export interface DroppedSessionNode {
  type?: string
  configuration?: string
}

/**
 * `filterSessionInPlace` over a whole session, telling the user which tracks
 * it dropped: one config with a refused value costs its own track, never the
 * session.
 */
export function dropUnloadableTracks(
  session: IAnyStateTreeNode & {
    notify?: (message: string, level: 'warning') => void
  },
) {
  const dropped = filterSessionInPlace(session, getType(session))
  if (dropped.length > 0) {
    const names = dropped
      .map(d => d.configuration ?? d.type ?? 'unknown')
      .join(', ')
    const plural = dropped.length > 1
    session.notify?.(
      `Removed ${dropped.length} track${plural ? 's' : ''} that could not be loaded: ${names}`,
      'warning',
    )
  }
}

// Cleans a freshly-loaded session in place by dropping any array/map element
// that can't be hydrated — e.g. an open track whose `configuration` reference
// resolves to a dangling id or a structurally-invalid config and throws when
// read. Dropping keeps the invariant that the open set only ever holds usable
// tracks (matching the open/add paths, which refuse invalid configs), so
// downstream code never has to defend against a track whose config access
// throws. Returns the dropped nodes so the caller can tell the user which
// tracks went missing.
//
// Dangling references in collections are NOT this function's job: every session
// reference is a `types.safeReference`, whose onInvalidated removes the entry
// from its parent at load. The `isValidReference` branch below is a backstop
// for any future plain `types.reference` collection.
export function filterSessionInPlace(
  node: IAnyStateTreeNode,
  type: IAnyType,
  dropped: DroppedSessionNode[] = [],
): DroppedSessionNode[] {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (node !== undefined) {
    if (isArrayType(type)) {
      const array = node as MSTArray
      const childType = getChildType(node)
      const isRef = isReferenceType(childType)
      for (let i = 0; i < array.length;) {
        if (
          !walkChildOrDrop(
            () => array[i],
            () => (getSnapshot(array) as unknown[])[i],
            childType,
            isRef,
            dropped,
          )
        ) {
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
        if (
          !walkChildOrDrop(
            () => map.get(key),
            () => (getSnapshot(map) as Record<string, unknown>)[key],
            childType,
            isRef,
            dropped,
          )
        ) {
          map.delete(key)
        }
      }
    } else if (isModelType(type)) {
      const { properties } = getPropertyMembers(node)
      // A node holding a `configuration` reference is a track/display/
      // connection. Its only load-time integrity concern is that the config
      // resolves: reading it throws for a dangling id or a structurally-invalid
      // config, which the caller turns into a drop. Stop here instead of
      // recursing — the first config-bearing node on the path to a display is
      // the track itself, and recursing past it would eagerly instantiate child
      // state models (displays) and run their afterAttach before the view is
      // measured. That throws on view.width and would be misread as an invalid
      // node, dropping a valid track. Display configs resolve through their own
      // safety net (the track config's preProcessSnapshot injects a stub
      // display per registered type).
      if ('configuration' in properties) {
        void node.configuration
      } else {
        for (const [pname, ptype] of Object.entries(properties)) {
          filterSessionInPlace(node[pname], ptype, dropped)
        }
      }
    }
  }
  return dropped
}

// Returns false if the collection element should be dropped: a dangling
// reference (removed silently — see header), or a config-bearing node that
// throws while hydrating (recorded in `dropped` so the caller can report it).
// Otherwise recurses into it and returns true.
function walkChildOrDrop(
  get: () => IAnyStateTreeNode,
  snapshotOf: () => unknown,
  childType: IAnyType,
  isRef: boolean,
  dropped: DroppedSessionNode[],
) {
  if (isRef) {
    return isValidReference(get)
  }
  let child: IAnyStateTreeNode | undefined
  try {
    child = get()
    filterSessionInPlace(child, childType, dropped)
    return true
  } catch (e) {
    console.error(e)
    dropped.push(describeDroppedNode(child, snapshotOf))
    return false
  }
}

// Identifies a dropped node for a user-facing message by reading its serialized
// snapshot, which keeps a dangling `configuration` reference (the usual cause of
// a drop) from throwing again — references serialize to their stored id string.
// A node whose creation threw has none, so its entry in the parent's snapshot
// stands in.
function describeDroppedNode(
  node: IAnyStateTreeNode | undefined,
  snapshotOf: () => unknown,
): DroppedSessionNode {
  try {
    const raw = node === undefined ? snapshotOf() : getSnapshot(node)
    if (raw && typeof raw === 'object') {
      const snap = raw as { type?: unknown; configuration?: unknown }
      return {
        type: typeof snap.type === 'string' ? snap.type : undefined,
        configuration:
          typeof snap.configuration === 'string'
            ? snap.configuration
            : undefined,
      }
    }
  } catch (e) {
    console.error(e)
  }
  return {}
}
