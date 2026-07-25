import { isSessionWithAddTracks } from '@jbrowse/core/util'
import {
  allSessionTracks,
  resolveSyntenyTrackActions,
} from '@jbrowse/synteny-core'
import { toJS, transaction } from 'mobx'

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
    if (isSessionWithAddTracks(session)) {
      // a dotplot is the single-pair case of the same resolution the synteny
      // form runs per row pair
      const [action] = resolveSyntenyTrackActions({
        tracks: allSessionTracks(session),
        selections: model.importFormSyntenyTrackSelections,
        assemblyNames: [assemblyX, assemblyY],
      })
      if (action?.kind === 'open') {
        session.addTrackConf(toJS(action.conf))
        model.toggleTrack(action.conf.trackId)
      } else if (action?.kind === 'show') {
        model.showTrack(action.trackId)
      }
    }
    model.setAssemblyNames(assemblyX, assemblyY)
  })
}
