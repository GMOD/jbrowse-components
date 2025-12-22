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
  const { id, ...rest } = getSnapshot(view)
  const newView = getSession(view).addView('LinearGenomeView', {
    ...rest,
    tracks: rest.tracks.map(({ id, ...r }) => r),
    displayedRegions: mergeIntervals(
      subs.map(f => ({
        refName,
        start: f.get('start') - padding,
        end: f.get('end') + padding,
        assemblyName: view.assemblyNames[0],
      })),
      padding,
    ),
  }) as LinearGenomeViewModel
  await when(() => newView.initialized)

  newView.showAllRegions()
}
