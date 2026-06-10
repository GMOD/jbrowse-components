import { getSession, mergeIntervals, stripTrackIds } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const isExonOrCDS = (f: Feature) =>
  f.get('type') === 'exon' || f.get('type') === 'CDS'

export function getExonsAndCDS(transcripts: Feature[]) {
  return transcripts.flatMap(
    transcript => transcript.get('subfeatures')?.filter(isExonOrCDS) ?? [],
  )
}

export function featureHasExonsOrCDS(feature: Feature) {
  return (feature.get('subfeatures') ?? []).some(isExonOrCDS)
}

export function getTranscripts(feature?: Feature): Feature[] {
  if (!feature) {
    return []
  }
  return featureHasExonsOrCDS(feature)
    ? [feature]
    : (feature.get('subfeatures') ?? [])
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
 * whenever its gap exceeds 2*padding.
 */
export function buildCollapsedRegions({
  intervals,
  padding,
  refName,
  assemblyName,
}: {
  intervals: { start: number; end: number }[]
  padding: number
  refName: string
  assemblyName: string
}) {
  return mergeIntervals(
    intervals.map(f => ({
      refName,
      assemblyName,
      start: f.start - padding,
      end: f.end + padding,
    })),
    0,
  )
}

interface ViewState {
  bpPerPx: number
  offsetPx: number
}

/**
 * Calculate the initial view state (zoom and offset) to show all regions
 * centered and filling ~90% of the viewport width. The content occupies
 * `viewWidth * 0.9` px by construction, so centering leaves a fixed 5% margin
 * on each side regardless of the regions.
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

function buildArgs({
  view,
  transcripts,
  assembly,
  padding,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  padding: number
}) {
  const r0 = transcripts[0]?.get('refName')
  if (!r0) {
    return undefined
  }
  const refName = assembly.getCanonicalRefName2(r0)
  const subs = getExonsAndCDS(transcripts)
  const mergedRegions = buildCollapsedRegions({
    intervals: subs.map(f => ({ start: f.get('start'), end: f.get('end') })),
    padding,
    refName,
    assemblyName: assembly.name,
  })
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
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  padding: number
}) {
  const args = buildArgs({ view, transcripts, assembly, padding })
  if (!args) {
    return
  }
  view.setDisplayedRegions(args.mergedRegions)
  view.setNewView(args.initialState.bpPerPx, args.initialState.offsetPx)
}

export async function collapseIntrons({
  view,
  transcripts,
  assembly,
  padding,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  padding: number
}) {
  const args = buildArgs({ view, transcripts, assembly, padding })
  if (!args) {
    return
  }
  const snapshot = getSnapshot(view)
  const { id, ...rest } = snapshot
  // Compute bpPerPx/offsetPx upfront to avoid layout thrashing on the new view
  const newView = getSession(view).addView('LinearGenomeView', {
    ...rest,
    tracks: stripTrackIds(rest.tracks),
    displayedRegions: args.mergedRegions,
    bpPerPx: args.initialState.bpPerPx,
    offsetPx: args.initialState.offsetPx,
  }) as LinearGenomeViewModel
  await when(() => newView.initialized)
}
