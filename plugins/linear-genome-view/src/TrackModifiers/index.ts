import { getEnv, getSession } from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import {
  predicatesOf,
  testsSomething,
  withFields,
} from '@jbrowse/core/util/fieldPredicate'
import { normalizeTrackInit, trackDisplayType } from '@jbrowse/core/util/tracks'
import {
  buildDisplaySnapshot,
  displayCategory,
  memberPatch,
  memberWrites,
  mergeSettings,
  requestedDisplayType,
} from '@jbrowse/launch-args/displaySettings'
import {
  getSnapshot,
  getType,
  isArrayType,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { TrackInit } from '@jbrowse/core/util/tracks'
import type {
  Category,
  DisplaySettings,
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
  displayType?: string,
): Category {
  return displayCategory(
    trackDisplayType(
      pluginManager,
      conf,
      'LinearGenomeView',
      requestedDisplayType(modifiers) ?? displayType,
    ),
  )
}

/**
 * `displayCategoryOf` for a track the session holds; `displayType` is the
 * display the caller opens it as when no `display:` modifier names one.
 */
export function trackCategory(
  session: { getTrackById: (trackId: string) => unknown },
  trackId: string,
  modifiers: string[],
  displayType?: string,
): Category {
  const conf = session.getTrackById(trackId)
  return conf
    ? displayCategoryOf(
        getEnv(session).pluginManager,
        (isStateTreeNode(conf) ? getSnapshot(conf) : conf) as { type: string },
        modifiers,
        displayType,
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

// the entries grouped by field, as `setFilterFields` takes them: a field whose
// entries are all bare is `[]`, which clears it, defaults included
function filterPatch(entries: readonly FieldPredicate[]) {
  const patch: Record<string, FieldPredicate[]> = {}
  for (const p of entries) {
    patch[p.field] = [
      ...(patch[p.field] ?? []),
      ...(testsSomething(p) ? [p] : []),
    ]
  }
  return patch
}

// An alignments display, which merges over its slot's defaults itself
interface FilterDisplay {
  setFilterFields?: (patch: Record<string, FieldPredicate[]>) => void
  writtenFilter?: FieldPredicate[]
}

// the display snapshot a track opens with. `filter` stays out of it:
// `writeFilter` writes it once the track is open, since the list in a
// snapshot would replace the configured one
function launchSnapshot({ settings }: ModifierLaunch) {
  const { snap, displayType } = settings
  const { filter: _filter, ...unfiltered } = snap
  return {
    ...unfiltered,
    ...(displayType ? { type: displayType } : {}),
  }
}

/**
 * Write the `filter` of `trackId`'s `settings` onto its display open in
 * `view`, by field over the configured filter, as the track menu would.
 * Returns the display's filter as written, which reopens the track as drawn,
 * or undefined when the settings write no filter.
 */
export function writeFilter(
  view: Pick<ModifierView, 'tracks' | 'showTrack'>,
  trackId: string,
  settings: DisplaySettings,
) {
  const { filter } = settings.snap
  const track = view.tracks.find(t => t.configuration.trackId === trackId)
  if (!filter || !track) {
    return undefined
  }
  const patch = filterPatch(filter)
  const display = track.displays[0] as FilterDisplay | undefined
  if (display?.setFilterFields) {
    display.setFilterFields(patch)
    return display.writtenFilter
  }
  const written = withFields(
    predicatesOf(track.activeDisplay.configuration.filter),
    patch,
  )
  view.showTrack(trackId, {}, { filter: written })
  return written
}

/**
 * @deprecated `writeFilter`, which every display category takes. This one
 * writes an alignments `display`'s filter only.
 */
export function writeReadFilter(
  display: unknown,
  category: Category,
  settings: DisplaySettings,
) {
  const { filter } = settings.snap
  if (category !== 'alignments' || !filter) {
    return undefined
  }
  const filterDisplay = display as FilterDisplay | undefined
  filterDisplay?.setFilterFields?.(filterPatch(filter))
  return filterDisplay?.writtenFilter
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
  // a modifier writing an object (`filter`, `pileup`) writes the members it
  // names over the entry's own
  const launched = mergeSettings(
    structuredClone(displaySnapshot),
    launchSnapshot(launch),
  )
  const opened = await view.launchTrack(trackId, trackSnapshot, launched)
  if (!opened) {
    return undefined
  }
  const drawnFilter = writeFilter(view, trackId, launch.settings)
  const members = writeMembers(view, trackId, launch.members)
  return {
    trackId,
    ...launched,
    ...(drawnFilter ? { filter: drawnFilter } : {}),
    ...members,
  }
}

/**
 * Open a session spec's track entry in a navigated `view`, its `modifiers`
 * written over its display settings. When a modifier or the open fails, the
 * session's snackbar says why and the track opens with its own settings.
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
  const { type } = displaySnapshot
  const notes: string[] = []
  try {
    await launchTrackWithModifiers(
      view,
      trackId,
      trackCategory(
        session,
        trackId,
        modifiers,
        typeof type === 'string' ? type : undefined,
      ),
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
  }
  // launchTrack reports its own failure, such as a display:
  // the track cannot open as
  if (!view.tracks.some(t => t.configuration.trackId === trackId)) {
    await view.launchTrack(trackId, trackSnapshot, displaySnapshot)
  }
  if (notes.length) {
    session.notify(notes.join('; '), 'warning')
  }
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
