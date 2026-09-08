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

import { featureType, getSubfeatures } from '../../RenderFeatureDataRPC/util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { TrackSnapshot } from '@jbrowse/core/util/tracks'
import type { Region } from '@jbrowse/core/util/types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The four child shapes whose gaps are introns: exon/CDS on an annotation,
// match_part on a cDNA or EST alignment, and block on a BED12 that carried no
// thick region for the gene heuristic to promote.
const SPLICED_PART_TYPES = new Set(['exon', 'cds', 'match_part', 'block'])

export function isSplicedPartType(type: string | undefined) {
  return type !== undefined && SPLICED_PART_TYPES.has(type.toLowerCase())
}

const isSplicedPart = (f: Feature) => isSplicedPartType(featureType(f))

export function getSplicedParts(transcripts: Feature[]) {
  return transcripts.flatMap(transcript =>
    getSubfeatures(transcript).filter(isSplicedPart),
  )
}

export function featureHasSplicedParts(feature: Feature) {
  return getSubfeatures(feature).some(isSplicedPart)
}

function exonIntervals(transcripts: Feature[]) {
  return getSplicedParts(transcripts).map(f => ({
    start: f.get('start'),
    end: f.get('end'),
  }))
}

// A transcript carries spliced parts without being one, and wins over the
// feature's own parts: a gene carrying both mRNA children and stray exon
// children of its own is still a gene, and reading it as one transcript would
// silently merge every isoform.
export function getTranscripts(feature?: Feature): Feature[] {
  const children = feature
    ? getSubfeatures(feature).filter(
        f => !isSplicedPart(f) && featureHasSplicedParts(f),
      )
    : []
  return children.length > 0
    ? children
    : feature && featureHasSplicedParts(feature)
      ? [feature]
      : []
}

export function hasIntrons(transcripts: Feature[]) {
  const intervals = exonIntervals(transcripts)
  return intervals.length > 1 && mergeIntervals(intervals, 0).length > 1
}

// The dialog offers each transcript as well as their union, so any scope with
// an intron is worth opening it for: an isoform that retains an intron another
// splices out makes the union contiguous while the spliced isoform collapses.
export function hasCollapsibleIntrons(transcripts: Feature[]) {
  return hasIntrons(transcripts) || transcripts.some(t => hasIntrons([t]))
}

/**
 * Merges with w=0 because the padding is already baked into start/end, so an
 * intron collapses whenever its gap exceeds 2*padding.
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

// Only the canvas displays expose a solo set, so a view is searched
// structurally for whichever display can isolate.
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

// The track and display ids here still match a pre-stripTrackIds snapshot, so
// seeding and in-place isolation resolve the same display.
function findSoloDisplay(view: LinearGenomeViewModel, trackId: string) {
  const track = view.tracks.find(
    t => readConfObject(t.configuration, 'trackId') === trackId,
  )
  return track?.displays.find(isSoloCapable)
}

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
    // toggleSoloFeature collects without isolating, so a prior set that was
    // isolating has to be applied again.
    if (prevApplied) {
      display.applySolo()
    }
  }
}

// Seeds the persistent solo props onto the one display that supports solo, so
// no other display type sees an unknown property.
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
 * A result rather than a throw: the dialog calls this while rendering, and a
 * throw there takes the dialog down with it.
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
    return { error: 'No exons, CDS or blocks found to collapse' }
  }
  const refName = assembly.getCanonicalRefName2(rawRefName)
  const regions = buildCollapsedRegions({
    intervals,
    padding,
    refName,
    assembly,
  })
  if (regions.length === 0) {
    return {
      error: `Every exon of this feature lies past the end of ${refName}, so there is nothing on this assembly to collapse`,
    }
  }
  return {
    // reversed so a minus-strand gene reads 5'->3' left-to-right
    regions: flip
      ? regions.map(r => ({ ...r, reversed: true })).reverse()
      : regions,
  }
}

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
  // Isolate before handing the Undo over, so the undo callback closes over the
  // restore.
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
    // Has to overwrite the window `rest` carries, and has to be that window
    // rather than a bpPerPx/offsetPx pair: the view persists its viewport as a
    // genomic window, and its snapshot migration converts a bpPerPx only for a
    // snapshot carrying no window at all.
    ...fitAllRegionsWindow(
      sum(regions.map(r => r.end - r.start)),
      view.width,
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
 * `args` is undefined while the dialog has nothing valid to act on, which is
 * also when both buttons are disabled.
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
