import { getSession, mergeIntervals } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { when } from 'mobx'

import type { LinearGenomeViewModel } from '../../../LinearGenomeView'
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

  // Compute the correct bpPerPx and offsetPx for the new regions BEFORE creating the view
  const totalBp = mergedRegions.reduce((sum, r) => sum + (r.end - r.start), 0)
  const width = view.width
  const maxBpPerPx = totalBp / (width * 0.9)
  const numPaddings = Math.max(0, mergedRegions.length - 1)
  const interRegionPaddingWidth = 2 // INTER_REGION_PADDING_WIDTH
  const totalPaddingPx = numPaddings * interRegionPaddingWidth
  const totalContentPx = totalBp / maxBpPerPx + totalPaddingPx
  const centerPx = totalContentPx / 2
  const initialOffsetPx = Math.round(centerPx - width / 2)

  const newView = getSession(view).addView('LinearGenomeView', {
    ...rest,
    tracks: rest.tracks.map(({ id, ...r }) => r),
    displayedRegions: mergedRegions,
    // Set the correct bpPerPx and offsetPx from the start!
    bpPerPx: maxBpPerPx,
    offsetPx: initialOffsetPx,
  }) as LinearGenomeViewModel
  await when(() => newView.initialized)
}
