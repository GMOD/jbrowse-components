import { readConfObject } from '@jbrowse/core/configuration'
import { getSession, mergeIntervals, stripTrackIds } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { fitAllRegionsWindow } from '@jbrowse/plugin-linear-genome-view'

import {
  getSubfeatures,
  isCDS,
  isExon,
} from '../../RenderFeatureDataRPC/util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { TrackSnapshot } from '@jbrowse/core/util/tracks'
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
 * whenever its gap exceeds 2*padding. Regions are clamped to `bounds` (the
 * chromosome extents) so padding near a contig edge can't run past it.
 */
export function buildCollapsedRegions({
  intervals,
  padding,
  refName,
  assemblyName,
  bounds,
}: {
  intervals: { start: number; end: number }[]
  padding: number
  refName: string
  assemblyName: string
  bounds?: { start: number; end: number }
}) {
  const merged = mergeIntervals(
    intervals.map(f => ({
      refName,
      assemblyName,
      start: f.start - padding,
      end: f.end + padding,
    })),
    0,
  )
  return (
    merged
      // Interbase min is always 0, so clamp the low end even when the contig
      // bounds are unknown (assembly.regions lazy/unpopulated, or a refName
      // miss) — otherwise a gene within `padding` bp of position 0 gets a
      // negative start. The high end is only clamped when we actually know the
      // contig length.
      .map(r => ({
        ...r,
        start: Math.max(bounds?.start ?? 0, r.start),
        end: bounds ? Math.min(bounds.end, r.end) : r.end,
      }))
      // An exon lying wholly past the contig end — a GFF3 annotated against a
      // longer assembly than the FASTA in use, which JBrowse otherwise just
      // draws past the end of — leaves the high clamp BELOW the low one. Every
      // consumer sums region lengths, so one inverted region subtracts from the
      // view's total bp: enough of them and the window goes negative, and with
      // it bpPerPx, silently. Dropping it shows the exons that do exist; where
      // that leaves nothing, buildMergedRegions' emptiness check is what speaks.
      .filter(r => r.end > r.start)
  )
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

function buildMergedRegions({
  transcripts,
  assembly,
  padding,
  flip,
}: {
  transcripts: Feature[]
  assembly: Assembly
  padding: number
  flip: boolean
}) {
  const r0 = transcripts[0]?.get('refName')
  if (!r0) {
    // Surfaced by runIntronAction's catch, which keeps the dialog open — a
    // silent return here would close it as if the collapse had succeeded.
    throw new Error('Could not determine the feature refName')
  }
  const intervals = exonIntervals(transcripts)
  if (intervals.length === 0) {
    // An empty region set would blank the target view: the in-place path drops
    // it back to the import form, and the new-view path mints bpPerPx=0. Also
    // surfaced by runIntronAction, which keeps the dialog open.
    throw new Error('No exons or CDS found to collapse')
  }
  const refName = assembly.getCanonicalRefName2(r0)
  const bounds = assembly.regions?.find(r => r.refName === refName)
  const genomicRegions = buildCollapsedRegions({
    intervals,
    padding,
    refName,
    assemblyName: assembly.name,
    bounds: bounds ? { start: bounds.start, end: bounds.end } : undefined,
  })
  if (genomicRegions.length === 0) {
    // Exons exist but the contig doesn't reach them, so every one was dropped as
    // inverted (see buildCollapsedRegions). Same empty region set as the check
    // above and the same consequences, but naming the cause rather than
    // repeating "no exons" at a reader looking straight at some.
    throw new Error(
      `Every exon of this feature lies past the end of ${refName}, so there is nothing on this assembly to collapse`,
    )
  }
  // flip declaratively: reverse region order and mark each reversed so a
  // minus-strand gene reads 5'->3' left-to-right
  return flip
    ? genomicRegions.map(r => ({ ...r, reversed: true })).reverse()
    : genomicRegions
}

// Shared args for the two intron actions. `soloFeatureId` (set when the dialog's
// "Show only this feature" box is checked) isolates the resulting view's track
// to that feature; `trackId` locates the display to isolate. `label` names the
// new view — the clicked feature for the whole-gene action, the row's transcript
// for a single-transcript action.
interface IntronActionArgs {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  padding: number
  flip: boolean
  trackId: string
  soloFeatureId: string | undefined
  label: string
}

export function replaceIntrons({
  view,
  transcripts,
  assembly,
  padding,
  flip,
  trackId,
  soloFeatureId,
}: IntronActionArgs) {
  const mergedRegions = buildMergedRegions({
    transcripts,
    assembly,
    padding,
    flip,
  })
  // snapshot the prior location so "Undo" can restore the original view.
  // displayedRegions is a types.frozen (plain immutable array), so it's kept
  // by reference rather than via getSnapshot (which only accepts MST nodes)
  const previous = {
    displayedRegions: view.displayedRegions,
    bpPerPx: view.bpPerPx,
    offsetPx: view.offsetPx,
  }
  view.setDisplayedRegions(mergedRegions)
  // The view holds the collapsed regions now, so let it frame them itself —
  // fitAllRegions rather than showAllRegions, whose 10% margin belongs to "show
  // me everything" and not to a caller that named the regions it wants. The
  // window size the dialog asked for is already the context around each exon, so
  // a second margin on top of it is one nothing asked for; navToLocations and
  // viewMateRegion frame their named regions the same way. The other half of
  // agreeing is fitAllRegionsWindow, which is what the new-view button seeds.
  view.fitAllRegions()
  const restoreSolo =
    soloFeatureId === undefined
      ? undefined
      : soloFeatureInView(view, trackId, soloFeatureId)
  getSession(view).notify('Introns collapsed', 'info', {
    name: 'Undo',
    onClick: () => {
      view.setDisplayedRegions(previous.displayedRegions)
      view.setNewView(previous.bpPerPx, previous.offsetPx)
      restoreSolo?.()
    },
  })
}

// Run a collapse/replace action, close the dialog on success, and surface any
// failure through the session notifier. Shared by both intron buttons
// ("Replace", "Open in new view").
export function runIntronAction(
  view: LinearGenomeViewModel,
  action: () => void,
  handleClose: () => void,
) {
  try {
    action()
    handleClose()
  } catch (e) {
    getSession(view).notifyError(`${e}`, e)
    console.error(e)
  }
}

// Pure view snapshot for the collapsed-intron "Open in new view" action: merged
// regions, the viewport framing them, stripped track ids, and — when a solo
// feature is requested — the display seeded to open already isolated. Returns
// data only; collapseIntrons is the imperative sink that hands it to addView.
export function buildCollapsedViewSnapshot({
  view,
  transcripts,
  assembly,
  padding,
  flip,
  trackId,
  soloFeatureId,
  label,
}: IntronActionArgs) {
  const mergedRegions = buildMergedRegions({
    transcripts,
    assembly,
    padding,
    flip,
  })
  const { id, ...rest } = getSnapshot(view)
  const tracks =
    soloFeatureId === undefined
      ? rest.tracks
      : seedSoloInTracks(rest.tracks, view, trackId, soloFeatureId)
  return {
    ...rest,
    tracks: stripTrackIds(tracks),
    displayName: `${label} (introns collapsed)`,
    displayedRegions: mergedRegions,
    // The target view doesn't exist yet, so its viewport is seeded here rather
    // than by calling fitAllRegions on it (which is what replaceIntrons does to
    // the live view) — both to frame the same way and to avoid a first-render
    // flash. It MUST overwrite the window `rest` carries, and must be the window
    // rather than bpPerPx/offsetPx: the view persists its viewport as a genomic
    // window, and its snapshot migration converts a bpPerPx only for a snapshot
    // with no window at all. So the pair this used to emit was dropped in
    // silence on every launch, and the new view opened at the SOURCE view's zoom
    // and scroll — the whole gene locus, framing a region set a tenth its width.
    ...fitAllRegionsWindow(
      mergedRegions.reduce((sum, r) => sum + (r.end - r.start), 0),
      view.width,
    ),
  }
}

export function collapseIntrons(args: IntronActionArgs) {
  getSession(args.view).addView(
    'LinearGenomeView',
    buildCollapsedViewSnapshot(args),
  )
}
