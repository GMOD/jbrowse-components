import { applySyntenyTrackSelections } from '@jbrowse/synteny-core'
import { transaction } from 'mobx'

import type { DotplotViewModel } from '../../model.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export function doSubmit({
  model,
  session,
  assemblyX,
  assemblyY,
}: {
  model: DotplotViewModel
  session: AbstractSessionModel
  assemblyX: string
  assemblyY: string
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
    // applied now, so they don't outlive the form — see
    // clearImportFormSyntenyTracks
    model.clearImportFormSyntenyTracks()
  })
}
