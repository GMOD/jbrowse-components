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
    // a dotplot is the single-pair case of the same resolution the synteny form
    // runs per row pair, so it is the same call with one pair's worth of rows
    applySyntenyTrackSelections({
      session,
      selections: model.importFormSyntenyTrackSelections,
      assemblyNames: [assemblyX, assemblyY],
      showTrack: trackId => {
        model.showTrack(trackId)
      },
    })
    model.setAssemblyNames(assemblyX, assemblyY)

    // The axis restriction goes through the SAME declarative init a session
    // spec and LaunchView-DotplotView use, rather than a second
    // setDisplayedRegions path living here. It cannot be done inline: resolving
    // `*_MATERNAL` needs the assembly's regions, the assembly is generally not
    // loaded at the instant Launch is pressed, and waiting for that — then
    // replacing the whole-genome regions the regions autorun populates in the
    // meantime — is exactly what applyInit already does, ordered ahead of
    // autoDiagonalize. An init carrying only `views` is otherwise inert: its
    // tracks and display-settings steps each guard on their own key.
    const views = [
      { assembly: assemblyX, displayedRegionNames: parseRegionNames(regionsX) },
      { assembly: assemblyY, displayedRegionNames: parseRegionNames(regionsY) },
    ]
    // undefined rather than an init with two empty lists when neither box was
    // used: `init` is persisted and is what "has something to show" consults,
    // so an empty one is a request that never resolves to anything.
    model.setLaunch(
      views.some(v => v.displayedRegionNames.length > 0)
        ? { views }
        : undefined,
    )

    // applied now, so they don't outlive the form — see
    // clearImportFormSyntenyTracks
    model.clearImportFormSyntenyTracks()
  })
}
