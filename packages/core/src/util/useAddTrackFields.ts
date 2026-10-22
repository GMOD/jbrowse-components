import { useEffect } from 'react'

import { isAlive } from '@jbrowse/mobx-state-tree'

import { workflowForm } from './addTrackComponent.ts'

import type { AddTrackComponentModel } from './addTrackComponent.ts'

export interface AddTrackContribution {
  /** merged into the track config the widget builds */
  trackConfig: Record<string, unknown>
  /** why the track cannot be added yet; holds the Add button while set */
  missing?: string
}

/**
 * An add-track picker's fields and what they contribute to the track.
 *
 * The fields live on the widget model (`workflowForm`), so the drawer
 * unmounting the picker keeps them. Whenever they change, `contribute`'s
 * result becomes the widget's `mixinData`; the picker unmounting, as when the
 * user picks another adapter, takes it back. A picker therefore states only
 * what its fields mean, never when to write them.
 */
export function useAddTrackFields<T extends object>(
  model: AddTrackComponentModel,
  key: string,
  initial: T,
  contribute: (form: T) => AddTrackContribution,
) {
  const fields = workflowForm(model, key, initial)
  // the stored object changes on every update and goes back to undefined when
  // `clearData` resets the forms, so both re-contribute
  const stored = model.workflowForms[key]
  useEffect(
    () => {
      const { trackConfig, missing } = contribute(
        workflowForm(model, key, initial).form,
      )
      model.setMixinData(trackConfig, missing)
      return () => {
        if (isAlive(model)) {
          model.setMixinData({})
        }
      }
    },
    // `initial` and `contribute` are the picker's constants
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [model, key, stored],
  )
  return fields
}
