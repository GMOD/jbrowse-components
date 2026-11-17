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
export interface DroppedSessionNode {
  type?: string
  configuration?: string
}

// An open track whose config now names another registered track type, to be
// put back as `snapshot` at `index` among the elements its array kept.
interface RetypedTrack {
  entry: DroppedSessionNode
  array: MSTArray
  index: number
  snapshot: ReturnType<typeof shownTrackSnapshot>
  displayType: string
  reopenedAs: string
  displayReset: boolean
}

type LoadingSession = IAnyStateTreeNode & {
  notify?: (message: string, level: 'warning') => void
}

/**
 * `filterSessionInPlace` over a whole session, telling the user which tracks
 * it dropped: one config with a refused value costs its own track, never the
 * session. A track whose config changed type since the session was saved is
 * reopened as the new type instead.
 */
export function dropUnloadableTracks(session: LoadingSession) {
  const retyped: RetypedTrack[] = []
  const dropped = filterSessionInPlace(session, getType(session), [], retyped)
  const { pluginManager } = getEnv(session)
  const loads = retyped.flatMap(r => {
    const record = pluginManager.resolveDisplayTypeRecord(r.displayType)
    return record && !record.isStateModelLoaded ? [record.loadStateModel()] : []
  })
  if (loads.length === 0) {
    reportReopened(session, dropped, retyped)
  } else {
    Promise.all(loads)
      .then(() => {
        reportReopened(session, dropped, retyped)
      })
      .catch((e: unknown) => {
        console.error(e)
        notifyDropped(session, [...dropped, ...retyped.map(r => r.entry)], [])
      })
  }
}

function reportReopened(
  session: LoadingSession,
  dropped: DroppedSessionNode[],
  retyped: RetypedTrack[],
) {
  const reopened = reinsert(retyped)
  notifyDropped(
    session,
    [
      ...dropped,
      ...retyped.filter(r => !reopened.includes(r)).map(r => r.entry),
    ],
    reopened,
  )
}

function notifyDropped(
  session: LoadingSession,
  removed: DroppedSessionNode[],
  reopened: RetypedTrack[],
) {
  const message = [describeRemoved(removed), describeReopened(reopened)]
    .filter(line => line !== undefined)
    .join('. ')
  if (message && isAlive(session)) {
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

function describeReopened(reopened: RetypedTrack[]) {
  const reset = reopened.filter(r => r.displayReset)
  const plural = reopened.length > 1
  const resetNote =
    reset.length === 0
      ? ''
      : plural
        ? `; display settings were reset for ${reset.map(r => r.entry.configuration).join(', ')}`
        : '; its display settings were reset'
  return reopened.length > 0
    ? `Reopened ${reopened.length} track${plural ? 's' : ''} whose type changed: ${reopened
        .map(
          r => `${r.entry.configuration} (${r.entry.type} → ${r.reopenedAs})`,
        )
        .join(', ')}${resetNote}`
    : undefined
}

// Inserts each retyped track among the elements its array kept, in the order
// they were saved, unless its track is already open there again. A track that
// still fails to load is taken back out. Returns the ones now open.
function reinsert(retyped: RetypedTrack[]) {
  const insertedPerArray = new Map<MSTArray, number>()
  return retyped.filter(r => {
    let open = false
    if (isAlive(r.array)) {
      const elements: unknown[] = getSnapshot(r.array)
      if (
        elements.some(
          e =>
            isOpenTrackSnapshot(e) &&
            e.configuration === r.snapshot.configuration,
        )
      ) {
        open = true
      } else {
        const inserted = insertedPerArray.get(r.array) ?? 0
        const at = Math.min(r.index + inserted, r.array.length)
        let added = false
        try {
          applyPatch(r.array, { op: 'add', path: `/${at}`, value: r.snapshot })
          added = true
          void r.array[at].configuration
          insertedPerArray.set(r.array, inserted + 1)
          open = true
        } catch (e) {
          console.error(e)
          if (added) {
            applyPatch(r.array, { op: 'remove', path: `/${at}` })
          }
        }
      }
    }
    return open
  })
}

interface OpenTrackSnapshot {
  type: string
  configuration: string
  displays?: { type: string; [key: string]: unknown }[]
  [key: string]: unknown
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

// The old display is kept whole when the new type still feeds it in this
// view; otherwise its settings belong to another display type and are dropped.
function retypedTrack(
  array: MSTArray,
  index: number,
  saved: unknown,
  entry: DroppedSessionNode,
): RetypedTrack | undefined {
  if (isOpenTrackSnapshot(saved)) {
    const { type, configuration, displays, ...rest } = saved
    const { pluginManager } = getEnv(array)
    const liveConf = getSession(array).getTrackById(configuration)
    if (
      liveConf &&
      liveConf.type !== type &&
      pluginManager.trackTypes.has(liveConf.type)
    ) {
      const conf = toTrackConfigEntry(liveConf)
      const viewType = getContainingView(array).type
      const oldDisplay = displays?.[0]
      const kept = oldDisplay
        ? trackDisplayChoice(pluginManager, conf, viewType, oldDisplay.type)
        : undefined
      const keepsDisplay = kept !== undefined && kept.type === oldDisplay?.type
      const picked = keepsDisplay
        ? kept
        : trackDisplayChoice(pluginManager, conf, viewType)
      return picked
        ? {
            entry,
            array,
            index,
            snapshot: shownTrackSnapshot({
              trackId: configuration,
              trackType: liveConf.type,
              configuration,
              picked,
              initialSnapshot: rest,
              displayInitialSnapshot: keepsDisplay ? oldDisplay : {},
            }),
            displayType: picked.type,
            reopenedAs: liveConf.type,
            displayReset: !keepsDisplay,
          }
        : undefined
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
// tracks went missing. Given `retyped`, a dropped track whose config changed
// type goes there instead, for the caller to put back.
//
// Dangling references in collections are NOT this function's job: every session
// reference is a `types.safeReference`, whose onInvalidated removes the entry
// from its parent at load. The `isValidReference` branch below is a backstop
// for any future plain `types.reference` collection.
export function filterSessionInPlace(
  node: IAnyStateTreeNode,
  type: IAnyType,
  dropped: DroppedSessionNode[] = [],
  retyped?: RetypedTrack[],
): DroppedSessionNode[] {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (node !== undefined) {
    if (isArrayType(type)) {
      const array = node as MSTArray
      const childType = getChildType(node)
      const isRef = isReferenceType(childType)
      for (let i = 0; i < array.length;) {
        const failure = walkChildOrDrop(
          () => array[i],
          () => (getSnapshot(array) as unknown[])[i],
          childType,
          isRef,
          dropped,
          retyped,
        )
        if (failure === undefined) {
          i += 1
        } else {
          const saved = (getSnapshot(array) as unknown[])[i]
          array.splice(i, 1)
          if (failure !== 'dangling') {
            const reopen = retyped
              ? retypedTrackOrLog(array, i, saved, failure.entry)
              : undefined
            if (reopen) {
              retyped?.push(reopen)
            } else {
              console.error(failure.error)
              dropped.push(failure.entry)
            }
          }
        }
      }
    } else if (isMapType(type)) {
      const map = node as MSTMap
      const childType = getChildType(map)
      const isRef = isReferenceType(childType)
      for (const key of map.keys()) {
        const failure = walkChildOrDrop(
          () => map.get(key),
          () => (getSnapshot(map) as Record<string, unknown>)[key],
          childType,
          isRef,
          dropped,
          retyped,
        )
        if (failure !== undefined) {
          map.delete(key)
          if (failure !== 'dangling') {
            console.error(failure.error)
            dropped.push(failure.entry)
          }
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
          filterSessionInPlace(node[pname], ptype, dropped, retyped)
        }
      }
    }
  }
  return dropped
}

function retypedTrackOrLog(
  array: MSTArray,
  index: number,
  saved: unknown,
  entry: DroppedSessionNode,
) {
  try {
    return retypedTrack(array, index, saved, entry)
  } catch (e) {
    console.error(e)
    return undefined
  }
}

// Returns undefined when the collection element is kept and walked into,
// 'dangling' for a dangling reference (removed silently — see header), and
// otherwise the config-bearing node's hydration error with the node identified
// for the caller to report.
function walkChildOrDrop(
  get: () => IAnyStateTreeNode,
  snapshotOf: () => unknown,
  childType: IAnyType,
  isRef: boolean,
  dropped: DroppedSessionNode[],
  retyped: RetypedTrack[] | undefined,
) {
  return isRef
    ? isValidReference(get)
      ? undefined
      : 'dangling'
    : walkChild(get, snapshotOf, childType, dropped, retyped)
}

function walkChild(
  get: () => IAnyStateTreeNode,
  snapshotOf: () => unknown,
  childType: IAnyType,
  dropped: DroppedSessionNode[],
  retyped: RetypedTrack[] | undefined,
) {
  let child: IAnyStateTreeNode | undefined
  try {
    child = get()
    filterSessionInPlace(child, childType, dropped, retyped)
    return undefined
  } catch (error) {
    return { error, entry: describeDroppedNode(child, snapshotOf) }
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
