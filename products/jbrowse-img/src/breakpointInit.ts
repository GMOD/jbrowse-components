import {
  buildDisplaySnapshot,
  displayCategory,
} from '@jbrowse/launch-args/displaySettings'

import type { Config, OpenTrack, Opts } from './types.ts'
import type { TrackInit } from '@jbrowse/core/util/tracks'
import type { Entry } from '@jbrowse/launch-args'
import type { BreakpointSplitViewInitView } from '@jbrowse/plugin-breakpoint-split-view'

type DisplayTypeOf = (trackId: string, opts: string[]) => string | undefined

// Split out of renderRegion.ts because that module's pure-ESM deps cannot load
// under Jest's CJS transform.

/**
 * One panel per `--loc` flag; a space inside one `--loc` adds a window to that
 * panel. That is why this reads argv, where `opts.loc` holds only one flag.
 */
export function breakpointLocs(argv: Entry[] | undefined, loc?: string) {
  const fromArgv = (argv ?? [])
    .filter(([key]) => key === 'loc')
    .map(([, vals]) => vals.join(' ').trim())
    .filter(Boolean)
  return fromArgv.length > 0 ? fromArgv : loc ? [loc.trim()] : []
}

/**
 * Every track goes on every panel, since connecting curves are drawn only
 * across tracks present in all panels. Modifiers ride the `TrackInit`, because
 * a panel opens its tracks from its launch rather than `applyDisplayOpts`.
 * `filter` stays out: its list would replace the configured one, so
 * `writeFilter` writes it once each panel opens.
 */
export function breakpointTracks(
  openTracks: OpenTrack[],
  showTracks: OpenTrack[],
  displayTypeOf: DisplayTypeOf = () => undefined,
): TrackInit[] {
  return [...showTracks, ...openTracks].map(({ trackId, opts }) => {
    const opensAs = displayTypeOf(trackId, opts)
    const {
      snap: { filter: _filter, ...snap },
      sort,
      displayType,
    } = buildDisplaySnapshot(opensAs, opts)
    if (sort) {
      console.warn(
        `Warning: sort:${sort.field} on "${trackId}" ignored — a breakpoint view has one panel per --loc and no single center position`,
      )
    }
    return {
      trackId,
      // ahead of the snapshot, so the track's own sort wins
      ...(displayCategory(opensAs) === 'alignments'
        ? { sort: 'svSignal' }
        : {}),
      ...snap,
      ...(displayType ? { type: displayType } : {}),
    }
  })
}

// Not `viewSettingsFromSpec`, which would nest `views` a level too deep and
// render an empty view.
export function breakpointPanelsFromSpec(
  spec: Record<string, unknown>,
): BreakpointSplitViewInitView[] {
  const panels = spec.views
  if (!Array.isArray(panels)) {
    throw new Error(
      'a BreakpointSplitView --spec needs a "views" array, one entry per panel: ' +
        '{"type":"BreakpointSplitView","views":[{"assembly":"hg38","loc":"chr1:1-2","tracks":["t"]}, ...]}',
    )
  }
  if (panels.length < 2) {
    throw new Error(
      `a BreakpointSplitView --spec needs at least two panels in "views" (got ${panels.length})`,
    )
  }
  return panels as BreakpointSplitViewInitView[]
}

export function breakpointInit(
  data: Config,
  opts: Opts,
  showTracks: OpenTrack[],
  displayTypeOf?: DisplayTypeOf,
): BreakpointSplitViewInitView[] {
  const locs = breakpointLocs(opts.argv, opts.loc)
  if (locs.length < 2) {
    throw new Error(
      `breakpoint mode stacks one panel per --loc and needs at least two (got ${locs.length}). ` +
        'Repeat the flag: --loc chr1:1,000,000-1,001,000 --loc chr5:2,000,000-2,001,000. ' +
        'Quote a single --loc only to put SEVERAL windows in one panel.',
    )
  }
  const tracks = breakpointTracks(data.openTracks, showTracks, displayTypeOf)
  return locs.map(loc => ({ assembly: data.assembly.name, loc, tracks }))
}
