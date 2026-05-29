import { notEmpty } from '@jbrowse/core/util'
import { transaction } from 'mobx'

import type { HierarchicalTrackSelectorModel } from '../HierarchicalTrackSelectorWidget/model.ts'

/**
 * Select or deselect a set of tracks by id. In shopping-cart mode this mutates
 * the track-selector selection set; otherwise it shows/hides tracks on the
 * view. Single source of truth for both the per-row and select-all checkboxes.
 */
export function setTracksSelected(
  model: HierarchicalTrackSelectorModel,
  ids: string[],
  selected: boolean,
  useShoppingCart: boolean,
) {
  if (useShoppingCart) {
    const { selection } = model
    if (selected) {
      const current = new Set(selection.map(s => `${s.trackId}`))
      const toAdd = ids
        .filter(id => !current.has(id))
        .map(id => model.allTrackConfigurationMap.get(id))
        .filter(notEmpty)
      model.setSelection([...selection, ...toAdd])
    } else {
      const remove = new Set(ids)
      model.setSelection(selection.filter(s => !remove.has(`${s.trackId}`)))
    }
  } else {
    transaction(() => {
      for (const id of ids) {
        if (selected) {
          model.view.showTrack(id)
          model.addToRecentlyUsed(id)
        } else {
          model.view.hideTrack(id)
        }
      }
    })
  }
}
