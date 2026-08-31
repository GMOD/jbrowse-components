import { buildDisplaySnapshot, configTrackCategory } from './applyTrackOpts.ts'

import type { Entry } from './parseArgv.ts'
import type { Config, OpenTrack, Opts } from './types.ts'
import type { TrackInit } from '@jbrowse/core/util/tracks'
import type { BreakpointSplitViewInitView } from '@jbrowse/plugin-breakpoint-split-view'

// The `views` array a BreakpointSplitView is opened with, built from CLI flags.
// Pure, and split out of renderRegion.ts for the reason comparativeInit.ts is:
// that module imports the plugin renderToSvg chain, whose pure-ESM deps Jest's
// CJS transform can't load, so the snapshot shape would be untestable there.

/**
 * The panels, one per `--loc` FLAG.
 *
 * There are two nested levels here and they need different separators, which is
 * the whole reason this reads the raw argv rather than `opts.loc`:
 *
 * - **repeating `--loc` adds a PANEL** — a stacked LinearGenomeView
 * - **whitespace inside one `--loc` adds a REGION to that panel**, which is
 *   exactly what `parseLocStrings` already means by a space and what a
 *   discontinuous LGV is
 *
 * So `--loc chr1:1-100 --loc chr5:1-100` is two panels, and
 * `--loc "chr1:1-100 chr1:5,000-5,100" --loc chr5:1-100` is two panels of which
 * the first shows two windows of chr1. Collapsing both onto whitespace would
 * have made the common two-breakend case unspellable the moment either side
 * wanted a second window, and — worse — would have silently rendered one
 * picture when the user meant the other.
 *
 * The pleasant side effect is that the common case needs no shell quoting at
 * all, since neither locstring contains a space.
 *
 * `standardizeArgv` keeps only the first value of the last `--loc`, so the
 * repeated form is invisible downstream of it; this is why the entries are read
 * from `argv`. The tokens of one flag are joined rather than taking `vals[0]`,
 * so an unquoted `--loc chr1:1-100 chr1:5-6` means the same as the quoted form
 * instead of silently dropping the second window.
 */
export function breakpointLocs(argv: Entry[] | undefined, loc?: string) {
  const fromArgv = (argv ?? [])
    .filter(([key]) => key === 'loc')
    .map(([, vals]) => vals.join(' ').trim())
    .filter(Boolean)
  // `opts.loc` is the fallback for a programmatic call that passed no argv (the
  // library entry point, and the tests below). One flag's worth, so it can only
  // ever describe a single panel — which then fails the >=2 check with the
  // message that names the fix.
  return fromArgv.length > 0 ? fromArgv : loc ? [loc.trim()] : []
}

/**
 * Every track the run opened, shown on EVERY panel.
 *
 * Not a per-panel list, because the connecting curves are what this view type
 * is for and they are drawn only across `matchedTracks` — the tracks present in
 * all panels. A track shown on one panel contributes no ribbon, so a per-panel
 * spelling would let a caller silently ask for a picture with nothing joining
 * it up.
 *
 * **The `--track` MODIFIERS apply here too**, which they did not until this
 * function stopped returning bare trackIds. Every other mode routes them
 * through `applyDisplayOpts`, which calls `view.showTrack` with the built
 * snapshot; a breakpoint panel opens its tracks from its own recipe instead, so
 * that call site does not exist and `height:240 force:true` was parsed,
 * validated, warned about if misspelled — and then dropped. Silently, and in
 * the direction that looks like the setting not working: the two jbrowse-img
 * SV figures asked for `height:240` and got the default, and `force:true`
 * could not lift the byte gate off a 200x ONT panel at all.
 *
 * A `TrackInit` object carries the snapshot instead: every key except
 * `trackId`/`trackSnapshot`/`displaySnapshot` folds into the display snapshot
 * (`normalizeTrackInit`), which is the same route a session spec takes.
 */
export function breakpointTracks(
  openTracks: OpenTrack[] | undefined,
  showTracks: OpenTrack[],
  tracks: Config['tracks'] = [],
): TrackInit[] {
  return [...showTracks, ...(openTracks ?? [])].map(({ trackId, opts }) => {
    const { snap, sort, displayType } = buildDisplaySnapshot(
      configTrackCategory(tracks, trackId),
      opts,
    )
    if (sort) {
      // The center-line sort is resolved against a view's centerLineInfo, and
      // there is no single view here -- one panel per --loc, each at its own
      // locus, so "the position under the centre" is a different answer per
      // panel. Say so rather than sorting one panel and not the others.
      console.warn(
        `Warning: sort:${sort.type} on "${trackId}" ignored — a breakpoint view has one panel per --loc and no single center position`,
      )
    }
    return {
      trackId,
      ...snap,
      ...(displayType ? { type: displayType } : {}),
    }
  })
}

/**
 * The panel array a `--spec` supplies directly.
 *
 * The panels are the view's `views`, one entry per stacked panel.
 *
 * Not the shared `viewSettingsFromSpec`, which hands the rest of the object
 * over whole — for this view that would nest the array a level too deep
 * (`{views: {views: [...]}}`), which the launch autorun reads as "no panels"
 * and renders as an empty view rather than as an error.
 */
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
): BreakpointSplitViewInitView[] {
  const locs = breakpointLocs(opts.argv, opts.loc)
  if (locs.length < 2) {
    throw new Error(
      `breakpoint mode stacks one panel per --loc and needs at least two (got ${locs.length}). ` +
        'Repeat the flag: --loc chr1:1,000,000-1,001,000 --loc chr5:2,000,000-2,001,000. ' +
        'Quote a single --loc only to put SEVERAL windows in one panel.',
    )
  }
  const tracks = breakpointTracks(data.openTracks, showTracks, data.tracks)
  return locs.map(loc => ({ assembly: data.assembly.name, loc, tracks }))
}
