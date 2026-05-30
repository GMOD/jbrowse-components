import { isSessionWithAddTracks } from '@jbrowse/core/util'
import { pickSyntenyTrackId } from '@jbrowse/synteny-core'
import { toJS, transaction } from 'mobx'

import type { DotplotViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

/**
 * Resolve the radio choice + picker state into a single track selection. The
 * built-in "Existing track" picker uses local state with a first-match
 * default; the custom-upload and extension-point selectors report through the
 * model, so those choices read the model slot.
 */
export function resolveImportFormSelection({
  choice,
  preConfiguredTrackId,
  syntenyTracks,
  modelSelection,
}: {
  choice: string
  preConfiguredTrackId: string
  syntenyTracks: AnyConfigurationModel[]
  modelSelection: ImportFormSyntenyTrack | undefined
}): ImportFormSyntenyTrack {
  if (choice === 'tracklist') {
    const value = pickSyntenyTrackId(preConfiguredTrackId, syntenyTracks)
    return value ? { type: 'preConfigured', value } : { type: 'none' }
  } else {
    return toJS(modelSelection) ?? { type: 'none' }
  }
}

export function doSubmit({
  model,
  session,
  assemblyX,
  assemblyY,
  selection,
}: {
  model: DotplotViewModel
  session: AbstractSessionModel
  assemblyX: string
  assemblyY: string
  selection: ImportFormSyntenyTrack
}) {
  model.setError(undefined)
  transaction(() => {
    if (isSessionWithAddTracks(session)) {
      if (selection.type === 'userOpened' && selection.value !== undefined) {
        session.addTrackConf(selection.value)
        model.toggleTrack(selection.value.trackId)
      } else if (selection.type === 'preConfigured') {
        model.showTrack(selection.value)
      }
    }
    model.setAssemblyNames(assemblyX, assemblyY)
  })
}
