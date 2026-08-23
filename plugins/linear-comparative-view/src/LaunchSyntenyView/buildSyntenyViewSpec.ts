import { assembleLocString } from '@jbrowse/core/util'
import { launchSyntenyView } from '@jbrowse/synteny-core'

import { anchorSpanOfPanels, resolveFeaturePanels } from './resolvePanel.ts'

import type { LinearSyntenyViewInit } from '../LinearSyntenyView/types.ts'
import type { RegionOfInterest, ResolvedPanel } from './resolvePanel.ts'
import type {
  AbstractSessionModel,
  AbstractViewModel,
  Feature,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/core/util/tracks'

// Pad a whole-base span by windowSize and render it as a locstring.
// assembleLocString is what makes this 1-based: navToLocString parses the result
// back as 1-based inclusive, so emitting the raw interbase start would open the
// view one base left of the alignment. The rounding is `resolvePanel`'s, not
// this function's — the values arriving here are already whole and already
// ordered; the floor/ceil below only survive a fractional `windowSize`. The
// `end` floor keeps at least one base, since a zero-width span (windowSize 0
// over a single-base CIGAR mapping) would assemble into an inverted locstring.
function paddedLocString({
  refName,
  start,
  end,
  windowSize,
  reversed,
}: {
  refName: string
  start: number
  end: number
  windowSize: number
  reversed?: boolean
}) {
  const lo = Math.max(0, Math.floor(start - windowSize))
  return assembleLocString({
    refName,
    start: lo,
    end: Math.max(lo + 1, Math.ceil(end + windowSize)),
    reversed,
  })
}

export interface BuildSyntenyViewSpecArgs {
  // One per launched mate panel, top to bottom, already resolved onto both axes
  // — see `resolvePanel`, which is also what the dialog previews.
  panels: ResolvedPanel[]
  // The assembly and contig the anchor panel opens on. Passed rather than read
  // off an alignment: the launching view already knows both, and a feature whose
  // `assemblyName` field is missing would otherwise silently produce a panel
  // with no assembly at all.
  anchorAssembly: string
  anchorRefName: string
  // Where the anchor sits in the launched stack, 0 (the top) by default. A band
  // is drawn between adjacent panels only, so with three or more panels off a
  // reference-anchored dataset the anchor's position decides how many bands are
  // direct pairs: on top, only the first is; in the middle, the two either side
  // of it are. The launch dialog exposes it as a draggable row.
  anchorIndex?: number
  windowSize: number
  trackId: string
  // Open a mate panel reversed when its alignment is on the minus strand, so its
  // coordinates still run left to right alongside the anchor's.
  flipReversedMates: boolean
  // Open the launched panels collapsed to their rulers. Unset means the launch's
  // own default: a multi-way launch collapses (a mate panel gets no tracks, so
  // on a stack the per-row "No tracks active" block is the tallest thing in the
  // view), a pairwise one does not, since two rows have the room. The dialog's
  // checkbox passes it explicitly either way. A row that HAS tracks never
  // collapses whatever this says — see buildViews' scalebarOnly.
  collapseEmptyRows?: boolean
  // Tracks for the anchor panel, normally the launching view's own (see
  // anchorPanelTracks). Only the anchor row: it is the only panel whose assembly
  // the source view can speak for.
  anchorTracks?: TrackInit[]
}

// Pure snapshot builder for the launched synteny view, mirroring
// buildReadVsRefSpec — session mutation is the caller's
// (launchSyntenyViewForPanels below), so the coordinate math is testable
// without a session.
export function buildSyntenyViewSpec({
  panels,
  anchorAssembly,
  anchorRefName,
  anchorIndex = 0,
  windowSize,
  trackId,
  flipReversedMates,
  collapseEmptyRows,
  anchorTracks,
}: BuildSyntenyViewSpecArgs): { init: LinearSyntenyViewInit } {
  if (!panels.length) {
    throw new Error('No alignments to launch a synteny view on')
  }
  // non-null because `panels` is non-empty above, which is the same thing
  // `anchorSpanOfPanels` answers `undefined` for
  const anchorSpan = anchorSpanOfPanels(panels)!
  const anchorView = {
    assembly: anchorAssembly,
    loc: paddedLocString({
      refName: anchorRefName,
      ...anchorSpan,
      windowSize,
    }),
    // omitted rather than empty when there is nothing to carry over, so the
    // launched view's snapshot says "no tracks" the same way it always did
    ...(anchorTracks?.length ? { tracks: anchorTracks } : {}),
  }
  const mateViews = panels.map(panel => ({
    assembly: panel.assemblyName,
    loc: paddedLocString({
      refName: panel.refName,
      start: panel.mateStart,
      end: panel.mateEnd,
      windowSize,
      reversed: flipReversedMates && panel.reversed,
    }),
  }))

  return {
    init: {
      collapseEmptyRows: collapseEmptyRows ?? panels.length > 1,
      views: [
        ...mateViews.slice(0, anchorIndex),
        anchorView,
        ...mateViews.slice(anchorIndex),
      ],
      // One synteny strip per gap between panels. The same track serves every
      // level: the view passes each level's two assemblies down to the adapter,
      // and an all-vs-all adapter resolves the pair from them.
      tracks: panels.map(() => [trackId]),
    },
  }
}

export function launchSyntenyViewForPanels({
  session,
  replacing,
  ...rest
}: BuildSyntenyViewSpecArgs & {
  session: AbstractSessionModel
  // the launching view, when the dialog's "Replace current view" was used
  replacing?: AbstractViewModel
}) {
  launchSyntenyView({
    session,
    viewType: 'LinearSyntenyView',
    replacing,
    ...buildSyntenyViewSpec(rest),
  })
}

/**
 * The same launch for a caller holding alignments rather than resolved panels:
 * the pairwise right-click and the feature-detail link, which have one clicked
 * block and no discovery RPC behind them. The anchor contig is the alignments'
 * own, which they all share by construction.
 */
export function launchSyntenyViewForFeatures({
  features,
  region,
  ...rest
}: Omit<
  Parameters<typeof launchSyntenyViewForPanels>[0],
  'panels' | 'anchorRefName'
> & {
  features: Feature[]
  region?: RegionOfInterest
}) {
  const anchor = features[0]
  if (!anchor) {
    throw new Error('No alignments to launch a synteny view on')
  }
  launchSyntenyViewForPanels({
    ...rest,
    anchorRefName: anchor.get('refName'),
    panels: resolveFeaturePanels(features, region),
  })
}
