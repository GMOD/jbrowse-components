import { getEnv, getSession } from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { trackDisplayType } from '@jbrowse/core/util/tracks'
import {
  buildDisplaySnapshot,
  displayCategory,
  memberPatch,
  memberWrites,
  requestedDisplayType,
} from '@jbrowse/launch-args/displaySettings'
import {
  getSnapshot,
  getType,
  isArrayType,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'

import type {
  Category,
  DisplaySettings,
  ReadFilterSnapshot,
} from '@jbrowse/launch-args/displaySettings'

/** The linear view a command line's tracks open in, as these helpers read it. */
export interface ModifierView {
  centerLineInfo?: {
    refName?: string
    offset: number
    start: number
    end: number
    reversed?: boolean
    oob?: boolean
  }
  launchTrack: (
    trackId: string,
    trackSnapshot?: object,
    displaySnapshot?: object,
  ) => Promise<{ displays: unknown[] } | undefined>
  showTrack: (
    trackId: string,
    trackSnapshot?: object,
    displaySnapshot?: object,
  ) => unknown
  tracks: {
    configuration: { trackId: string }
    activeDisplay: { configuration: Record<string, unknown> }
  }[]
}

/**
 * The category of the display a linear view opens `trackId` as, read off the
 * session's own display picker so it follows `display:` and the adapter rather
 * than a list of track types.
 */
export function trackCategory(
  session: { getTrackById: (trackId: string) => unknown },
  trackId: string,
  modifiers: string[],
): Category {
  const conf = session.getTrackById(trackId)
  if (!conf) {
    return 'other'
  }
  const { pluginManager } = getEnv(session)
  return displayCategory(
    trackDisplayType(
      pluginManager,
      (isStateTreeNode(conf) ? getSnapshot(conf) : conf) as { type: string },
      'LinearGenomeView',
      requestedDisplayType(modifiers),
    ),
  )
}

function lastSessionError(view: ModifierView) {
  try {
    const { snackbarMessages } = getSession(view) as unknown as {
      snackbarMessages: { message: string; level?: string }[]
    }
    return snackbarMessages.findLast(m => m.level === 'error')?.message
  } catch {
    return undefined
  }
}

interface LaunchOptions {
  /** changes the settings after the center-line sort resolves, before the open */
  adjust?: (settings: DisplaySettings) => void
  /** hears of a modifier that could not apply; the console's by default */
  warn?: (message: string) => void
}

/**
 * Open `trackId` in `view` with its command-line modifiers applied, and return
 * the session-spec track entry that reopens it as drawn.
 */
export async function launchTrackWithModifiers(
  view: ModifierView,
  trackId: string,
  category: Category,
  modifiers: string[],
  {
    adjust,
    warn = message => {
      console.warn(`Warning: ${message}`)
    },
  }: LaunchOptions = {},
) {
  const settings = buildDisplaySnapshot(category, modifiers, warn)
  const { snap, sort, displayType } = settings
  // the pivot is the base under the view's center, which a view has only
  // once it shows a region
  if (sort) {
    const center = view.centerLineInfo
    if (center && !center.oob) {
      snap.sort = {
        field: sort.field,
        pos: basePaintedAt(center, center.offset),
        refName: center.refName ?? '',
      }
    } else {
      warn(
        `sort:${sort.field} on "${trackId}" ignored — the view has no center position to sort at (pass --loc)`,
      )
    }
  }
  adjust?.(settings)

  // The launch snapshot merges `filter` into the configured one member by
  // member, except `tags`, a list it replaces: a `filterTag:` is one more
  // condition on the track's own, so the tags are added after the open.
  const readFilter =
    category === 'alignments' &&
    typeof snap.filter === 'object' &&
    !Array.isArray(snap.filter)
      ? snap.filter
      : undefined
  const { tags, ...launchFilter } = readFilter ?? {}
  const displaySnap = tags ? { ...snap, filter: launchFilter } : snap

  const opened = await view.launchTrack(
    trackId,
    {},
    displayType ? { ...displaySnap, type: displayType } : displaySnap,
  )
  // launchTrack says why it failed only to the session's snackbar
  if (!opened) {
    const reason = lastSessionError(view)
    throw new Error(
      `Failed to open track "${trackId}"${displayType ? ` with display "${displayType}"` : ''}${reason ? `: ${reason}` : ''}`,
    )
  }
  if (tags) {
    const display = opened.displays[0] as
      | { readFilter?: ReadFilterSnapshot }
      | undefined
    view.showTrack(
      trackId,
      {},
      { filter: { tags: [...(display?.readFilter?.tags ?? []), ...tags] } },
    )
  }
  const members = writeMembers(view, trackId, memberWrites(category, modifiers))
  const drawnFilter = readFilter && readFilterAsDrawn(opened, readFilter)
  return {
    trackId,
    ...displaySnap,
    ...(drawnFilter ? { filter: drawnFilter } : {}),
    ...members,
    ...(displayType ? { type: displayType } : {}),
  }
}

// the read members the display holds, beside the junction and connection
// tests the modifiers named
function readFilterAsDrawn(
  opened: { displays: unknown[] },
  stated: ReadFilterSnapshot,
): ReadFilterSnapshot | undefined {
  const display = opened.displays[0] as
    | {
        readFilter?: ReadFilterSnapshot
        junctionFilter?: Record<string, unknown>
        connectionFilter?: Record<string, unknown>
      }
    | undefined
  return display?.readFilter
    ? {
        ...display.readFilter,
        ...(stated.junctions
          ? { junctions: display.junctionFilter ?? stated.junctions }
          : {}),
        ...(stated.connections
          ? { connections: display.connectionFilter ?? stated.connections }
          : {}),
      }
    : undefined
}

/**
 * Write a track's `memberWrites` onto what its display in `view` already has,
 * after every other modifier, so a member write keeps the rest of the setting
 * whatever order the command line gives them in. A display replaces a color
 * or facet object whole, which is why these cannot ride in on the launch
 * snapshot.
 */
export function writeMembers(
  view: Pick<ModifierView, 'tracks' | 'showTrack'>,
  trackId: string,
  members: string[],
): Record<string, unknown> {
  if (members.length === 0) {
    return {}
  }
  const track = view.tracks.find(t => t.configuration.trackId === trackId)
  if (!track) {
    throw new Error(
      `"${trackId}" is not open, so ${members.join(' ')} has nothing to write to`,
    )
  }
  const { configuration } = track.activeDisplay
  const configured: Record<string, unknown> = getSnapshot(configuration)
  const patch = memberPatch(members, root => {
    // a list at a default the snapshot strips, Manhattan's marks, still seeds
    // the write, so `marks.0.mark=bar` edits the mark drawn
    const member = configuration[root]
    return (
      configured[root] ??
      (isStateTreeNode(member) && isArrayType(getType(member))
        ? getSnapshot(member)
        : undefined)
    )
  })
  view.showTrack(trackId, {}, patch)
  return patch
}
