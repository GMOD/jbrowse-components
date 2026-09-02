import { readConfObject } from '@jbrowse/core/configuration'
import {
  clampToContig,
  getNotificationSink,
  getSession,
  mergeIntervals,
  notEmpty,
  stripTrackIds,
  sum,
} from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  fitAllRegionsWindow,
  showRegionsWithUndo,
} from '@jbrowse/plugin-linear-genome-view'

import {
  getSubfeatures,
  isCDS,
  isExon,
} from '../../RenderFeatureDataRPC/util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { TrackSnapshot } from '@jbrowse/core/util/tracks'
import type { Region } from '@jbrowse/core/util/types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const isExonOrCDS = (f: Feature) => isExon(f) || isCDS(f)

export function getExonsAndCDS(transcripts: Feature[]) {
  return transcripts.flatMap(transcript =>
    getSubfeatures(transcript).filter(isExonOrCDS),
  )
}

export function featureHasExonsOrCDS(feature: Feature) {
  return getSubfeatures(feature).some(isExonOrCDS)
}

function exonIntervals(transcripts: Feature[]) {
  return getExonsAndCDS(transcripts).map(f => ({
    start: f.get('start'),
    end: f.get('end'),
  }))
}

// A transcript is a feature carrying exon/CDS children, so a clicked
// transcript is used as-is and a clicked gene contributes its transcript
// subfeatures. Subfeatures without exon/CDS children (a bare tRNA, a
// pseudogenic_transcript with no children) are dropped: they hold no interval
// to collapse, so offering one as a transcript row could only produce an empty
// region set. Same filter core's featureTypeUtil.getTranscripts applies for the
// sequence panel.
export function getTranscripts(feature?: Feature): Feature[] {
  if (!feature) {
    return []
  }
  return featureHasExonsOrCDS(feature)
    ? [feature]
    : getSubfeatures(feature).filter(featureHasExonsOrCDS)
}

export function hasIntrons(transcripts: Feature[]) {
  const intervals = exonIntervals(transcripts)
  return intervals.length > 1 && mergeIntervals(intervals, 0).length > 1
}

/**
 * Build the collapsed-intron regions from exon/CDS intervals. Each interval is
 * expanded by `padding` on both sides (the visible window around each splice
 * boundary), then overlapping padded intervals are merged. Merging uses w=0
 * because the padding is already baked into start/end; an intron is collapsed
 * whenever its gap exceeds 2*padding.
 *
 * `clampToContig` keeps the padding from running off either end of the contig,
 * and drops a window the contig doesn't reach at all rather than handing back an
 * inverted one — see it for why that matters and how it happens.
 */
export function buildCollapsedRegions({
  intervals,
  padding,
  refName,
  assembly,
}: {
  intervals: { start: number; end: number }[]
  padding: number
  refName: string
  assembly: Assembly
}) {
  return mergeIntervals(
    intervals.map(f => ({
      refName,
      start: f.start - padding,
      end: f.end + padding,
    })),
    0,
  )
    .map(r => clampToContig(assembly, r))
    .filter(notEmpty)
}

// The canvas displays expose a solo set ("show only these features"); other
// display types don't. Structural guard so we can reach it on whichever display
// in a view is capable of isolating.
interface SoloCapableDisplay {
  soloFeatureIds: string[]
  soloApplied: boolean
  soloFeature: (featureId: string) => void
  toggleSoloFeature: (featureId: string) => void
  applySolo: () => void
  clearSolo: () => void
}

function isSoloCapable(d: unknown): d is SoloCapableDisplay {
  return (
    typeof d === 'object' &&
    d !== null &&
    'soloFeature' in d &&
    typeof d.soloFeature === 'function'
  )
}

// Locate the solo-capable display of the track matched by `trackId` in `view`.
// The track/display ids still match a pre-stripTrackIds snapshot, so seeding and
// in-place isolation resolve the same display.
function findSoloDisplay(view: LinearGenomeViewModel, trackId: string) {
  const track = view.tracks.find(
    t => readConfObject(t.configuration, 'trackId') === trackId,
  )
  return track?.displays.find(isSoloCapable)
}

// Isolate the track (matched by trackId) in `view` to a single feature via the
// canvas display's solo set, returning a callback that restores the display's
// prior solo state. Used by the in-place "Replace" action, where the display
// already exists so isolating is a direct action call — and its Undo needs to
// reverse the isolation, not just the region/zoom change.
export function soloFeatureInView(
  view: LinearGenomeViewModel,
  trackId: string,
  featureId: string,
): () => void {
  const display = findSoloDisplay(view, trackId)
  if (!display) {
    return () => {}
  }
  const prevIds = [...display.soloFeatureIds]
  const prevApplied = display.soloApplied
  display.soloFeature(featureId)
  return () => {
    display.clearSolo()
    for (const id of prevIds) {
      display.toggleSoloFeature(id)
    }
    // toggleSoloFeature collects without isolating; re-apply only if the prior
    // set was actually isolating (an applied set is always non-empty).
    if (prevApplied) {
      display.applySolo()
    }
  }
}

// Seed the collapsed view's snapshot so its solo-capable display opens already
// isolated to `featureId` — declarative, so the new view needs no post-init
// action call. soloFeatureIds/soloApplied are persistent display props; we set
// them only on the display that actually supports solo (located by id in the
// source `view`, whose track/display ids still match the snapshot before
// stripTrackIds runs), so no other display type sees an unknown property.
export function seedSoloInTracks(
  tracks: TrackSnapshot[],
  view: LinearGenomeViewModel,
  trackId: string,
  featureId: string,
): TrackSnapshot[] {
  const soloDisplayId = findSoloDisplay(view, trackId)?.id
  return soloDisplayId === undefined
    ? tracks
    : tracks.map(t => ({
        ...t,
        displays: t.displays.map(d =>
          d.id === soloDisplayId
            ? { ...d, soloFeatureIds: [featureId], soloApplied: true }
            : d,
        ),
      }))
}

/**
 * The regions a collapse would show, or the reason it would show none.
 *
 * A RESULT rather than a throw because the dialog calls this while rendering — to
 * say how many regions the current window size produces, and to disable its
 * buttons when the answer is none. A throw there takes the dialog down with it,
 * and the reader finding out on click was the worse half of the shape this
 * replaces: both of these cases were exceptions raised out of a button handler
 * into a snackbar, after the dialog had already closed.
 */
export type CollapseResult = { regions: Region[] } | { error: string }

interface CollapseSpec {
  transcripts: Feature[]
  assembly: Assembly
  padding: number
  flip: boolean
}

export function collapsedRegionsFor({
  transcripts,
  assembly,
  padding,
  flip,
}: CollapseSpec): CollapseResult {
  const rawRefName = transcripts[0]?.get('refName')
  if (!rawRefName) {
    return { error: 'Could not determine the feature refName' }
  }
  const intervals = exonIntervals(transcripts)
  if (intervals.length === 0) {
    return { error: 'No exons or CDS found to collapse' }
  }
  const refName = assembly.getCanonicalRefName2(rawRefName)
  const regions = buildCollapsedRegions({
    intervals,
    padding,
    refName,
    assembly,
  })
  if (regions.length === 0) {
    // Exons exist but the contig doesn't reach them, so clampToContig dropped
    // every one. Naming the cause, rather than repeating "no exons" at a reader
    // looking straight at some.
    return {
      error: `Every exon of this feature lies past the end of ${refName}, so there is nothing on this assembly to collapse`,
    }
  }
  return {
    // flip declaratively: reverse region order and mark each reversed so a
    // minus-strand gene reads 5'->3' left-to-right
    regions: flip
      ? regions.map(r => ({ ...r, reversed: true })).reverse()
      : regions,
  }
}

// What the two intron actions need beyond the regions themselves, which the
// dialog has already built (see collapsedRegionsFor). `soloFeatureId` (set when
// the dialog's "Show only this feature" box is checked) isolates the resulting
// view's track to that feature; `trackId` locates the display to isolate.
// `label` names the new view — the clicked feature for the whole-gene action, the
// row's transcript for a single-transcript action.
interface IntronActionArgs {
  view: LinearGenomeViewModel
  regions: Region[]
  trackId: string
  soloFeatureId: string | undefined
  label: string
}

export function replaceIntrons({
  view,
  regions,
  trackId,
  soloFeatureId,
}: IntronActionArgs) {
  // Isolate BEFORE handing the Undo over, so the undo callback closes over the
  // restore. showRegionsWithUndo owns the framing, the viewport capture and the
  // notification — shared with plugin-alignments' "view mate region", which is
  // the other launcher that navigates the view you are looking at.
  const restoreSolo =
    soloFeatureId === undefined
      ? undefined
      : soloFeatureInView(view, trackId, soloFeatureId)
  showRegionsWithUndo({
    view,
    regions,
    message: 'Introns collapsed',
    alsoUndo: restoreSolo,
  })
}

// Pure view snapshot for the collapsed-intron "Open in new view" action: the
// regions, the viewport framing them, stripped track ids, and — when a solo
// feature is requested — the display seeded to open already isolated. Returns
// data only; collapseIntrons is the imperative sink that hands it to addView.
export function buildCollapsedViewSnapshot({
  view,
  regions,
  trackId,
  soloFeatureId,
  label,
}: IntronActionArgs) {
  const { id: _id, type: _type, ...rest } = getSnapshot(view)
  const tracks =
    soloFeatureId === undefined
      ? rest.tracks
      : seedSoloInTracks(rest.tracks, view, trackId, soloFeatureId)
  return {
    ...rest,
    tracks: stripTrackIds(tracks),
    displayName: `${label} (introns collapsed)`,
    displayedRegions: regions,
    // The target view doesn't exist yet, so its viewport is seeded here rather
    // than by calling fitAllRegions on it (which is what showRegionsWithUndo does
    // to the live view) — both to frame the same way and to avoid a first-render
    // flash. It MUST overwrite the window `rest` carries, and must be the window
    // rather than bpPerPx/offsetPx: the view persists its viewport as a genomic
    // window, and its snapshot migration converts a bpPerPx only for a snapshot
    // with no window at all. So the pair this used to emit was dropped in
    // silence on every launch, and the new view opened at the SOURCE view's zoom
    // and scroll — the whole gene locus, framing a region set a tenth its width.
    ...fitAllRegionsWindow(
      sum(regions.map(r => r.end - r.start)),
      view.width,
      // the new view inherits this one's zoom floor, being the same view type
      view.minBpPerPx,
    ),
  }
}

export function collapseIntrons(args: IntronActionArgs) {
  getSession(args.view).addView(
    'LinearGenomeView',
    buildCollapsedViewSnapshot(args),
  )
}

/**
 * Run one of the two intron actions on a click, close the dialog, and surface an
 * unexpected failure rather than leaving the dialog open saying nothing.
 *
 * `args` is undefined while the dialog has nothing valid to act on, which is also
 * when both buttons are disabled — taking it here rather than at each call site
 * is what lets the handlers be one line each. The EXPECTED failures no longer
 * reach this: `collapsedRegionsFor` returns them and the dialog shows them before
 * anything is clicked. What is left is the genuinely unforeseen — a snapshot that
 * won't build, an addView that rejects — where closing the dialog as if it had
 * worked is the wrong half to get right.
 */
export function runIntronAction(
  args: IntronActionArgs | undefined,
  action: (args: IntronActionArgs) => void,
  handleClose: () => void,
) {
  if (!args) {
    return
  }
  try {
    action(args)
    handleClose()
  } catch (e) {
    getNotificationSink(args.view).notifyError(`${e}`, e)
    console.error(e)
  }
}
