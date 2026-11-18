import { parseRegionNames } from '@jbrowse/core/util'
import { applySyntenyTrackSelections } from '@jbrowse/synteny-core'
import { transaction } from 'mobx'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type {
  AssemblyHost,
  NotificationSink,
  TrackCatalog,
} from '@jbrowse/core/util'

export function doSubmit({
  selectedAssemblyNames,
  regionNames = [],
  model,
  session,
}: {
  selectedAssemblyNames: string[]
  // per row, parallel to selectedAssemblyNames; '' or absent means the whole
  // assembly
  regionNames?: string[]
  model: LinearSyntenyViewModel
  session: AssemblyHost & NotificationSink & TrackCatalog
}) {
  transaction(() => {
    model.setError(undefined)
    const tracks = selectedAssemblyNames.slice(1).map((): string[] => [])
    applySyntenyTrackSelections({
      session,
      selections: model.importFormSyntenyTrackSelections,
      assemblyNames: selectedAssemblyNames,
      showTrack: (trackId, level) => {
        tracks[level]?.push(trackId)
      },
    })
    const [first, second, ...rest] = selectedAssemblyNames
    // the launch a session spec writes, so the rows, their tracks and the
    // re-order land in the order applyInit already keeps
    model.setLaunch({
      views: selectedAssemblyNames.map((assembly, idx) => {
        const displayedRegionNames = parseRegionNames(regionNames[idx] ?? '')
        return {
          assembly,
          ...(displayedRegionNames.length ? { displayedRegionNames } : {}),
        }
      }),
      tracks,
      // one pair of different genomes, the case the circular view re-orders by
      // default: a longer stack keeps its rows as the assemblies order them
      autoDiagonalize:
        rest.length === 0 && first !== second && tracks.some(t => t.length > 0),
    })
    model.clearImportFormSyntenyTracks()
  })
}
