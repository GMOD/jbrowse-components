import { types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import type { ImportFormSyntenyTrack } from './SelectorTypes.ts'

/**
 * #stateModel ImportFormSyntenyMixin
 * #category view
 *
 * The synteny track each row pair of a view's import form has picked, held on
 * the model so it outlives the form's per-pair remounts. Composed by the linear
 * synteny, dotplot and circular views.
 */
export function ImportFormSyntenyMixin() {
  return types
    .model('ImportFormSynteny', {})
    .volatile(() => ({
      /**
       * #volatile
       */
      importFormSyntenyTrackSelections:
        observable.array<ImportFormSyntenyTrack>(),
    }))
    .actions(self => ({
      /**
       * #action
       */
      setImportFormSyntenyTrack(idx: number, val: ImportFormSyntenyTrack) {
        self.importFormSyntenyTrackSelections[idx] = val
      },
      /**
       * #action
       * Drop the pending selections once a launch has applied them. Left in
       * place they outlive the form: "Return to import form" would reopen on
       * a finished upload from the previous launch, and a pair whose
       * assemblies no longer match it reads as an unfinished upload and
       * disables Launch.
       */
      clearImportFormSyntenyTracks() {
        self.importFormSyntenyTrackSelections.clear()
      },
    }))
}
