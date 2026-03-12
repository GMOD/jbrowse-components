import { getSession, mergeIntervals } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function featureHasExonsOrCDS(feature: Feature) {
  const subs = feature.get('subfeatures') ?? []
  return subs.some(
    (f: Feature) => f.get('type') === 'exon' || f.get('type') === 'CDS',
  )
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
  const subs = transcripts.flatMap(
    transcript =>
      transcript
        .get('subfeatures')
        ?.filter(
          (f: Feature) => f.get('type') === 'exon' || f.get('type') === 'CDS',
        ) ?? [],
  )
  if (subs.length < 2) {
    return false
  }
  const merged = mergeIntervals(
    subs.map((f: Feature) => ({ start: f.get('start'), end: f.get('end') })),
    0,
  )
  return merged.length > 1
}

export function getExonsAndCDS(transcripts: Feature[]) {
  return transcripts.flatMap(
    transcript =>
      transcript
        .get('subfeatures')
        ?.filter(f => f.get('type') === 'exon' || f.get('type') === 'CDS') ??
      [],
  )
}

function calculateInitialViewState(
  regions: { start: number; end: number }[],
  viewWidth: number,
) {
  const totalBp = regions.reduce((sum, r) => sum + (r.end - r.start), 0)
  const bpPerPx = totalBp / (viewWidth * 0.9)
  const numPaddings = Math.max(0, regions.length - 1)
  const interRegionPaddingWidth = 2
  const totalPaddingPx = numPaddings * interRegionPaddingWidth
  const totalContentPx = totalBp / bpPerPx + totalPaddingPx
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
