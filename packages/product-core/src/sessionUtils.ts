import { getContainingView, getEnv, getSession } from '@jbrowse/core/util'
import {
  shownTrackSnapshot,
  toTrackConfigEntry,
  trackDisplayChoice,
} from '@jbrowse/core/util/tracks'
import {
  applyPatch,
  getChildType,
  getPropertyMembers,
  getSnapshot,
  getType,
  isAlive,
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
// `reopenedAs` is the track type it was put back as, when its config changed
// type under it.
export interface DroppedSessionNode {
  type?: string
  configuration?: string
  reopenedAs?: string
  displayReset?: boolean
}

type ReopenTrack = (
  array: MSTArray,
  index: number,
  snapshot: unknown,
) => Pick<DroppedSessionNode, 'reopenedAs' | 'displayReset'> | undefined

/**
 * `filterSessionInPlace` over a whole session, telling the user which tracks
 * it dropped: one config with a refused value costs its own track, never the
 * session. A track whose config changed type since the session was saved is
 * reopened as the new type instead.
 */
export function dropUnloadableTracks(
  session: IAnyStateTreeNode & {
    notify?: (message: string, level: 'warning') => void
  },
) {
  const dropped = filterSessionInPlace(
    session,
    getType(session),
    [],
    reopenRetypedTrack,
  )
  const message = [
    describeRemoved(dropped.filter(d => d.reopenedAs === undefined)),
    describeReopened(dropped.filter(d => d.reopenedAs !== undefined)),
  ]
    .filter(line => line !== undefined)
    .join('. ')
  if (message) {
    session.notify?.(message, 'warning')
  }
}

function describeRemoved(removed: DroppedSessionNode[]) {
  return removed.length > 0
    ? `Removed ${removed.length} track${removed.length > 1 ? 's' : ''} that could not be loaded: ${removed
        .map(d => d.configuration ?? d.type ?? 'unknown')
        .join(', ')}`
    : undefined
}

function describeReopened(reopened: DroppedSessionNode[]) {
  const reset = reopened.filter(d => d.displayReset)
  const plural = reopened.length > 1
  const resetNote =
    reset.length === 0
      ? ''
      : plural
        ? `; display settings were reset for ${reset.map(d => d.configuration).join(', ')}`
        : '; its display settings were reset'
  return reopened.length > 0
    ? `Reopened ${reopened.length} track${plural ? 's' : ''} whose type changed: ${reopened
        .map(d => `${d.configuration} (${d.type} → ${d.reopenedAs})`)
        .join(', ')}${resetNote}`
    : undefined
}

interface OpenTrackSnapshot {
  id?: string
  type: string
  configuration: string
  minimized?: boolean
  pinned?: boolean
  displays?: { type: string; [key: string]: unknown }[]
}

function isOpenTrackSnapshot(snapshot: unknown): snapshot is OpenTrackSnapshot {
  return (
    !!snapshot &&
    typeof snapshot === 'object' &&
    'type' in snapshot &&
    typeof snapshot.type === 'string' &&
    'configuration' in snapshot &&
    typeof snapshot.configuration === 'string'
  )
}

// Puts back, at the index it was dropped from, an open track whose config now
// names another registered track type, so a config edit that retypes a track
// does not silently close it in every saved session. The old display is kept
// whole when the new type still feeds it in this view; otherwise the track
// opens with the display `showTrack` would pick, and the old display's
// settings, which belong to another display type, are not carried over.
const reopenRetypedTrack: ReopenTrack = (array, index, snapshot) => {
  const { pluginManager } = getEnv(array)
  const liveConf = isOpenTrackSnapshot(snapshot)
    ? getSession(array).getTrackById(snapshot.configuration)
    : undefined
  if (
    isOpenTrackSnapshot(snapshot) &&
    liveConf &&
    liveConf.type !== snapshot.type &&
    pluginManager.trackTypes.has(liveConf.type)
  ) {
    const conf = toTrackConfigEntry(liveConf)
    const viewType = getContainingView(array).type
    const oldDisplay = snapshot.displays?.[0]
    const kept = oldDisplay
      ? trackDisplayChoice(pluginManager, conf, viewType, oldDisplay.type)
      : undefined
    const keepsDisplay = kept !== undefined && kept.type === oldDisplay?.type
    const picked = keepsDisplay
      ? kept
      : trackDisplayChoice(pluginManager, conf, viewType)
    if (picked) {
      const value = shownTrackSnapshot({
        trackId: snapshot.configuration,
        trackType: liveConf.type,
        configuration: snapshot.configuration,
        picked,
        initialSnapshot: {
          id: snapshot.id,
          minimized: snapshot.minimized,
          pinned: snapshot.pinned,
        },
        displayInitialSnapshot: keepsDisplay ? oldDisplay : {},
      })
      const record = pluginManager.resolveDisplayTypeRecord(picked.type)
      if (!record || record.isStateModelLoaded) {
        array.splice(index, 0, value)
      } else {
        record
          .loadStateModel()
          .then(() => {
            if (isAlive(array)) {
              applyPatch(array, {
                op: 'add',
                path: `/${Math.min(index, array.length)}`,
                value,
              })
            }
          })
          .catch((e: unknown) => {
            console.error(e)
          })
      }
      return { reopenedAs: liveConf.type, displayReset: !keepsDisplay }
    }
  }
  return undefined
}

// Cleans a freshly-loaded session in place by dropping any array/map element
// that can't be hydrated — e.g. an open track whose `configuration` reference
// resolves to a dangling id or a structurally-invalid config and throws when
// read. Dropping keeps the invariant that the open set only ever holds usable
// tracks (matching the open/add paths, which refuse invalid configs), so
// downstream code never has to defend against a track whose config access
// throws. Returns the dropped nodes so the caller can tell the user which
// tracks went missing. `reopen` may put a dropped array element back in a form
// that loads.
//
// Dangling references in collections are NOT this function's job: every session
// reference is a `types.safeReference`, whose onInvalidated removes the entry
// from its parent at load. The `isValidReference` branch below is a backstop
// for any future plain `types.reference` collection.
export function filterSessionInPlace(
  node: IAnyStateTreeNode,
  type: IAnyType,
  dropped: DroppedSessionNode[] = [],
  reopen?: ReopenTrack,
): DroppedSessionNode[] {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (node !== undefined) {
    if (isArrayType(type)) {
      const array = node as MSTArray
      const childType = getChildType(node)
      const isRef = isReferenceType(childType)
      for (let i = 0; i < array.length;) {
        const droppedBefore = dropped.length
        if (
          walkChildOrDrop(
            () => array[i],
            () => (getSnapshot(array) as unknown[])[i],
            childType,
            isRef,
            dropped,
            reopen,
          )
        ) {
          i += 1
        } else {
          const snapshot = (getSnapshot(array) as unknown[])[i]
          array.splice(i, 1)
          const entry = dropped[droppedBefore]
          if (entry && reopen) {
            try {
              dropped[droppedBefore] = {
                ...entry,
                ...reopen(array, i, snapshot),
              }
            } catch (e) {
              console.error(e)
            }
          }
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
            reopen,
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
          filterSessionInPlace(node[pname], ptype, dropped, reopen)
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
  reopen: ReopenTrack | undefined,
) {
  if (isRef) {
    return isValidReference(get)
  }
  let child: IAnyStateTreeNode | undefined
  try {
    child = get()
    filterSessionInPlace(child, childType, dropped, reopen)
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
