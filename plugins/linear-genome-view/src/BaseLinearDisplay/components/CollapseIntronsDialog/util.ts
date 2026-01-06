import { getSession, mergeIntervals } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'

import type { LinearGenomeViewModel } from '../../../LinearGenomeView/index.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

export function getExonsAndCDS(transcripts: Feature[]) {
  return transcripts.flatMap(
    transcript =>
      transcript
        .get('subfeatures')
        ?.filter(f => f.get('type') === 'exon' || f.get('type') === 'CDS') ??
      [],
  )
}

interface ViewState {
  bpPerPx: number
  offsetPx: number
}

/**
 * Calculate the initial view state (zoom and offset) to show all regions
 * centered and filling ~90% of the viewport width.
 */
export function calculateInitialViewState(
  regions: { start: number; end: number }[],
  viewWidth: number,
): ViewState {
  const totalBp = regions.reduce((sum, r) => sum + (r.end - r.start), 0)

  // Zoom to fit all regions in 90% of viewport width
  const bpPerPx = totalBp / (viewWidth * 0.9)

  // Account for inter-region padding when centering
  const numPaddings = Math.max(0, regions.length - 1)
  const interRegionPaddingWidth = 2 // INTER_REGION_PADDING_WIDTH constant
  const totalPaddingPx = numPaddings * interRegionPaddingWidth
  const totalContentPx = totalBp / bpPerPx + totalPaddingPx

  // Center the content in the viewport
  const centerPx = totalContentPx / 2
  const offsetPx = Math.round(centerPx - viewWidth / 2)

  return { bpPerPx, offsetPx }
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
  const r0 = transcripts[0]?.get('refName')
  if (!r0) {
    return
  }
  const refName = assembly.getCanonicalRefName2(r0)
  const subs = getExonsAndCDS(transcripts)
  const snapshot = getSnapshot(view)
  const { id, offsetPx, bpPerPx, ...rest } = snapshot
  const mergedRegions = mergeIntervals(
    subs.map(f => ({
      refName,
      start: f.get('start') - padding,
      end: f.get('end') + padding,
      assemblyName: view.assemblyNames[0],
    })),
    padding,
  )

  // Compute the correct bpPerPx and offsetPx for the new regions BEFORE creating the view.
  // We do this upfront (instead of calling showAllRegions() after creation) to avoid
  // rendering with incorrect values and then updating, which would cause layout thrashing.
  const initialState = calculateInitialViewState(mergedRegions, view.width)

  const newView = getSession(view).addView('LinearGenomeView', {
    ...rest,
    tracks: rest.tracks.map(({ id, ...r }) => r),
    displayedRegions: mergedRegions,
    bpPerPx: initialState.bpPerPx,
    offsetPx: initialState.offsetPx,
  }) as LinearGenomeViewModel
  await when(() => newView.initialized)
}
