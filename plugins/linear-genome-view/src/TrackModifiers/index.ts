import { getEnv, getSession } from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { normalizeTrackInit, trackDisplayType } from '@jbrowse/core/util/tracks'
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

import type PluginManager from '@jbrowse/core/PluginManager'
import type { TrackInit } from '@jbrowse/core/util/tracks'
import type {
  Category,
  DisplaySettings,
  ReadFilterSnapshot,
} from '@jbrowse/launch-args/displaySettings'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

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
    displays: unknown[]
    activeDisplay: { configuration: Record<string, unknown> }
  }[]
}

/**
 * The category of the display a linear view opens `conf` as, read off the
 * display picker so it follows `display:` and the adapter rather than a list
 * of track types.
 */
function displayCategoryOf(
  pluginManager: PluginManager,
  conf: { type: string },
  modifiers: string[],
): Category {
  return displayCategory(
    trackDisplayType(
      pluginManager,
      conf,
      'LinearGenomeView',
      requestedDisplayType(modifiers),
    ),
  )
}

/** `displayCategoryOf` for a track the session holds. */
export function trackCategory(
  session: { getTrackById: (trackId: string) => unknown },
  trackId: string,
  modifiers: string[],
): Category {
  const conf = session.getTrackById(trackId)
  return conf
    ? displayCategoryOf(
        getEnv(session).pluginManager,
        (isStateTreeNode(conf) ? getSnapshot(conf) : conf) as { type: string },
        modifiers,
      )
    : 'other'
}

const consoleWarn = (message: string) => {
  console.warn(`Warning: ${message}`)
}

// a track's modifiers split at the open: the settings it opens with, and the
// member writes that wait for the opened display
interface ModifierLaunch {
  category: Category
  settings: DisplaySettings
  members: string[]
}

function modifierLaunch(
  category: Category,
  modifiers: string[],
  warn = consoleWarn,
): ModifierLaunch {
  return {
    category,
    settings: buildDisplaySnapshot(category, modifiers, warn),
    members: memberWrites(category, modifiers),
  }
}

function readFilterOf({ category, settings }: ModifierLaunch) {
  const { filter } = settings.snap
  return category === 'alignments' &&
    typeof filter === 'object' &&
    !Array.isArray(filter)
    ? filter
    : undefined
}

// the display snapshot a track opens with. It merges `filter` into the
// configured one member by member, except `tags`, a list it replaces: a
// `filterTag:` adds to the track's own tags, which `finishOpen` reads once open
function launchSnapshot(launch: ModifierLaunch) {
  const { snap, displayType } = launch.settings
  const { tags, ...launchFilter } = readFilterOf(launch) ?? {}
  return {
    ...snap,
    ...(tags ? { filter: launchFilter } : {}),
    ...(displayType ? { type: displayType } : {}),
  }
}

// the pivot is the base under the view's center, which a view has only once
// it shows a region
function centerSort(
  view: ModifierView,
  trackId: string,
  field: string,
  warn: (message: string) => void,
) {
  const center = view.centerLineInfo
  if (center && !center.oob) {
    return {
      field,
      pos: basePaintedAt(center, center.offset),
      refName: center.refName ?? '',
    }
  } else {
    warn(
      `sort:${field} on "${trackId}" ignored — the view has no center position to sort at (pass --loc)`,
    )
    return undefined
  }
}

// the tags `filterTag:` adds to the configured ones, then the member writes
function finishOpen(
  view: ModifierView,
  trackId: string,
  launch: ModifierLaunch,
  opened: { displays: unknown[] },
) {
  const tags = readFilterOf(launch)?.tags
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
  return writeMembers(view, trackId, launch.members)
}

interface LaunchOptions {
  /** the track entry's own display settings, which the modifiers write over */
  displaySnapshot?: Record<string, unknown>
  trackSnapshot?: Record<string, unknown>
  /** changes the settings after the center-line sort resolves, before the open */
  adjust?: (settings: DisplaySettings) => void
  warn?: (message: string) => void
}

/**
 * Open `trackId` in `view` with its command-line modifiers applied, and return
 * the session-spec track entry that reopens it as drawn, or undefined when the
 * open fails, which `launchTrack` reports to the session.
 */
export async function launchTrackWithModifiers(
  view: ModifierView,
  trackId: string,
  category: Category,
  modifiers: string[],
  {
    displaySnapshot = {},
    trackSnapshot = {},
    adjust,
    warn = consoleWarn,
  }: LaunchOptions = {},
) {
  const launch = modifierLaunch(category, modifiers, warn)
  const { snap, sort } = launch.settings
  const at = sort && centerSort(view, trackId, sort.field, warn)
  if (at) {
    snap.sort = at
  }
  adjust?.(launch.settings)
  const opened = await view.launchTrack(trackId, trackSnapshot, {
    ...displaySnapshot,
    ...launchSnapshot(launch),
  })
  if (!opened) {
    return undefined
  }
  const members = finishOpen(view, trackId, launch, opened)
  const readFilter = readFilterOf(launch)
  const drawnFilter = readFilter && readFilterAsDrawn(opened, readFilter)
  return {
    trackId,
    ...displaySnapshot,
    ...launchSnapshot(launch),
    ...(drawnFilter ? { filter: drawnFilter } : {}),
    ...members,
  }
}

/**
 * Open a session spec's track entry in a navigated `view`, its `modifiers`
 * written over its display settings. A modifier that fails goes to the
 * session's snackbar, and the track opens with its own settings.
 */
export async function launchTrackInit(
  view: ModifierView & IAnyStateTreeNode,
  t: TrackInit,
) {
  const { trackId, trackSnapshot, displaySnapshot, modifiers } =
    normalizeTrackInit(t)
  if (modifiers.length === 0) {
    await view.launchTrack(trackId, trackSnapshot, displaySnapshot)
    return
  }
  const session = getSession(view)
  const notes: string[] = []
  try {
    await launchTrackWithModifiers(
      view,
      trackId,
      trackCategory(session, trackId, modifiers),
      modifiers,
      {
        trackSnapshot,
        displaySnapshot,
        warn: message => notes.push(message),
      },
    )
  } catch (e) {
    console.error(e)
    session.notifyError(`"${trackId}" ${modifiers.join(' ')}: ${e}`, e)
    if (!view.tracks.some(t => t.configuration.trackId === trackId)) {
      await view.launchTrack(trackId, trackSnapshot, displaySnapshot)
    }
  }
  if (notes.length) {
    session.notify(notes.join('; '), 'warning')
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
