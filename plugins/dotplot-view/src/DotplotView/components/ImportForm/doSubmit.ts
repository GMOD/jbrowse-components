import { isSessionWithAddTracks } from '@jbrowse/core/util'
import { toJS, transaction } from 'mobx'

import type { DotplotViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export function doSubmit({
  model,
  session,
  assemblyX,
  assemblyY,
  choice,
  preConfiguredTrackId,
  syntenyTracks,
}: {
  model: DotplotViewModel
  session: AbstractSessionModel
  assemblyX: string
  assemblyY: string
  choice: string
  preConfiguredTrackId: string
  syntenyTracks: AnyConfigurationModel[]
}) {
  model.setError(undefined)
  transaction(() => {
    if (isSessionWithAddTracks(session)) {
      if (choice === 'tracklist') {
        // built-in picker default falls out of render: explicit pick, else
        // first matching track
        const trackId = preConfiguredTrackId || syntenyTracks[0]?.trackId
        if (trackId) {
          model.showTrack(trackId)
        }
      } else {
        // custom-upload and extension-point components report their selection
        // through the model
        for (const f of toJS(model.importFormSyntenyTrackSelections)) {
          if (f.type === 'userOpened' && f.value !== undefined) {
            session.addTrackConf(f.value)
            model.toggleTrack(f.value.trackId)
          } else if (f.type === 'preConfigured') {
            model.showTrack(f.value)
          }
        }
      }
    }
    model.setAssemblyNames(assemblyX, assemblyY)
  })
}
