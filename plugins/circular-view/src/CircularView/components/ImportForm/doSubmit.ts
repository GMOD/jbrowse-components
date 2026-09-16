import { parseRegionNames } from '@jbrowse/core/util'
import { applySyntenyTrackSelections } from '@jbrowse/synteny-core'
import { transaction } from 'mobx'

import type { CircularViewModel } from '../../model.ts'
import type {
  AssemblyHost,
  NotificationSink,
  TrackCatalog,
} from '@jbrowse/core/util'

/**
 * One launch blob from the form's rows: the assemblies in row order, each row's
 * chromosome list keyed by its assembly, the synteny track picked for the pair,
 * and the reorder. A self-alignment names one assembly twice and draws one arc.
 */
export function doSubmit({
  model,
  session,
  rows,
  regionNames = [],
  autoDiagonalize,
}: {
  model: CircularViewModel
  session: AssemblyHost & NotificationSink & TrackCatalog
  rows: string[]
  // per row, parallel to `rows`; '' or absent means the whole assembly
  regionNames?: string[]
  autoDiagonalize: boolean
}) {
  model.setError(undefined)
  transaction(() => {
    const tracks: string[] = []
    applySyntenyTrackSelections({
      session,
      selections: model.importFormSyntenyTrackSelections,
      assemblyNames: rows,
      showTrack: trackId => {
        tracks.push(trackId)
      },
    })
    const assembly = [...new Set(rows)]
    const displayedRegionNames: Record<string, string[]> = {}
    for (const [idx, name] of rows.entries()) {
      const names = parseRegionNames(regionNames[idx] ?? '')
      if (names.length) {
        displayedRegionNames[name] = [
          ...new Set([...(displayedRegionNames[name] ?? []), ...names]),
        ]
      }
    }
    model.setDisplayedRegions([])
    model.setLaunch({
      assembly,
      ...(Object.keys(displayedRegionNames).length
        ? { displayedRegionNames }
        : {}),
      ...(tracks.length ? { tracks } : {}),
      ...(autoDiagonalize && tracks.length && assembly.length === 2
        ? { autoDiagonalize }
        : {}),
    })
    model.clearImportFormSyntenyTracks()
  })
}
