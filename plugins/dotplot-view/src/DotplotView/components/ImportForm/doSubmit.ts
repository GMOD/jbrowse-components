import { parseRegionNames } from '@jbrowse/core/util'
import { applySyntenyTrackSelections } from '@jbrowse/synteny-core'
import { transaction } from 'mobx'

import type { DotplotViewModel } from '../../model.ts'
import type {
  AssemblyHost,
  NotificationSink,
  TrackCatalog,
} from '@jbrowse/core/util'

export function doSubmit({
  model,
  session,
  assemblyX,
  assemblyY,
  regionsX = '',
  regionsY = '',
}: {
  model: DotplotViewModel
  session: AssemblyHost & NotificationSink & TrackCatalog
  assemblyX: string
  assemblyY: string
  regionsX?: string
  regionsY?: string
}) {
  model.setError(undefined)
  transaction(() => {
    const tracks: string[] = []
    // a dotplot is the single-pair case of the same resolution the synteny form
    // runs per row pair, so it is the same call with one pair's worth of rows
    applySyntenyTrackSelections({
      session,
      selections: model.importFormSyntenyTrackSelections,
      assemblyNames: [assemblyX, assemblyY],
      showTrack: trackId => {
        tracks.push(trackId)
      },
    })
    model.setAssemblyNames(assemblyX, assemblyY)

    // The tracks, the axis restriction and the re-order go through the SAME
    // declarative init a session spec and LaunchView-DotplotView use: resolving
    // `*_MATERNAL` needs the assembly's regions, the re-order needs the track's
    // display, and applyInit already awaits each ahead of the next.
    const views = [
      { assembly: assemblyX, displayedRegionNames: parseRegionNames(regionsX) },
      { assembly: assemblyY, displayedRegionNames: parseRegionNames(regionsY) },
    ]
    // undefined rather than an init with nothing to do when no track and
    // neither box was used: `init` is persisted and is what "has something to
    // show" consults, so an empty one is a request that never resolves to
    // anything.
    model.setLaunch(
      tracks.length > 0 || views.some(v => v.displayedRegionNames.length > 0)
        ? {
            views,
            ...(tracks.length > 0
              ? {
                  tracks,
                  // two different genomes, the case the circular view
                  // re-orders by default
                  autoDiagonalize: assemblyX !== assemblyY,
                }
              : {}),
          }
        : undefined,
    )

    // applied now, so they don't outlive the form — see
    // clearImportFormSyntenyTracks
    model.clearImportFormSyntenyTracks()
  })
}
