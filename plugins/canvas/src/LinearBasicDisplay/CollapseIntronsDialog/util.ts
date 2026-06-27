import { getSession, mergeIntervals, stripTrackIds } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'

import {
  getSubfeatures,
  isCDS,
  isExon,
} from '../../RenderFeatureDataRPC/util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
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

export function getTranscripts(feature?: Feature): Feature[] {
  if (!feature) {
    return []
  }
  return featureHasExonsOrCDS(feature) ? [feature] : getSubfeatures(feature)
}

export function hasIntrons(transcripts: Feature[]) {
  const subs = getExonsAndCDS(transcripts)
  if (subs.length < 2) {
    return false
  }
  const merged = mergeIntervals(
    subs.map(f => ({ start: f.get('start'), end: f.get('end') })),
    0,
  )
  return merged.length > 1
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
  return bounds
    ? merged.map(r => ({
        ...r,
        start: Math.max(bounds.start, r.start),
        end: Math.min(bounds.end, r.end),
      }))
    : merged
}

interface ViewState {
  bpPerPx: number
  offsetPx: number
}

/**
 * Calculate the initial view state (zoom and offset) to show all regions
 * centered and filling ~90% of the viewport width. Mirrors the view's
 * `showAllRegions` action (SHOW_ALL_REGIONS_FILL=0.9), but is computed up front
 * so a freshly-created view renders at the right zoom without a flash.
 */
export function calculateInitialViewState(
  regions: { start: number; end: number }[],
  viewWidth: number,
): ViewState {
  const totalBp = regions.reduce((sum, r) => sum + (r.end - r.start), 0)
  const bpPerPx = totalBp / (viewWidth * 0.9)
  const offsetPx = Math.round(-0.05 * viewWidth)
  return { bpPerPx, offsetPx }
}

function transcriptLabel(transcripts: Feature[]) {
  const f = transcripts[0]
  return f?.get('name') ?? f?.get('id') ?? 'feature'
}

function buildArgs({
  view,
  transcripts,
  assembly,
  padding,
  flip,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  padding: number
  flip: boolean
}) {
  const r0 = transcripts[0]?.get('refName')
  if (!r0) {
    return undefined
  }
  const refName = assembly.getCanonicalRefName2(r0)
  const bounds = assembly.regions?.find(r => r.refName === refName)
  const subs = getExonsAndCDS(transcripts)
  const genomicRegions = buildCollapsedRegions({
    intervals: subs.map(f => ({ start: f.get('start'), end: f.get('end') })),
    padding,
    refName,
    assemblyName: assembly.name,
    bounds: bounds ? { start: bounds.start, end: bounds.end } : undefined,
  })
  // flip declaratively: reverse region order and mark each reversed so a
  // minus-strand gene reads 5'->3' left-to-right
  const mergedRegions = flip
    ? genomicRegions.map(r => ({ ...r, reversed: true })).reverse()
    : genomicRegions
  return {
    mergedRegions,
    initialState: calculateInitialViewState(mergedRegions, view.width),
  }
}

export function replaceIntrons({
  view,
  transcripts,
  assembly,
  padding,
  flip,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  padding: number
  flip: boolean
}) {
  const args = buildArgs({ view, transcripts, assembly, padding, flip })
  if (!args) {
    return
  }
  // snapshot the prior location so "Undo" can restore the original view.
  // displayedRegions is a types.frozen (plain immutable array), so it's kept
  // by reference rather than via getSnapshot (which only accepts MST nodes)
  const previous = {
    displayedRegions: view.displayedRegions,
    bpPerPx: view.bpPerPx,
    offsetPx: view.offsetPx,
  }
  view.setDisplayedRegions(args.mergedRegions)
  view.setNewView(args.initialState.bpPerPx, args.initialState.offsetPx)
  getSession(view).notify('Introns collapsed', 'info', {
    name: 'Undo',
    onClick: () => {
      view.setDisplayedRegions(previous.displayedRegions)
      view.setNewView(previous.bpPerPx, previous.offsetPx)
    },
  })
}

// Run a collapse/replace action, close the dialog on success, and surface any
// failure through the session notifier. Accepts sync or async actions so the
// "Replace" (sync) and "Open in new view" (async) buttons share one path.
export async function runIntronAction(
  view: LinearGenomeViewModel,
  action: () => void | Promise<void>,
  handleClose: () => void,
) {
  try {
    await action()
    handleClose()
  } catch (e) {
    getSession(view).notifyError(`${e}`, e)
    console.error(e)
  }
}

export async function collapseIntrons({
  view,
  transcripts,
  assembly,
  padding,
  flip,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  padding: number
  flip: boolean
}) {
  const args = buildArgs({ view, transcripts, assembly, padding, flip })
  if (!args) {
    return
  }
  const { id, ...rest } = getSnapshot(view)
  // Compute bpPerPx/offsetPx upfront to avoid layout thrashing on the new view
  const newView = getSession(view).addView('LinearGenomeView', {
    ...rest,
    tracks: stripTrackIds(rest.tracks),
    displayName: `${transcriptLabel(transcripts)} (introns collapsed)`,
    displayedRegions: args.mergedRegions,
    bpPerPx: args.initialState.bpPerPx,
    offsetPx: args.initialState.offsetPx,
  }) as LinearGenomeViewModel
  await when(() => newView.initialized)
}
