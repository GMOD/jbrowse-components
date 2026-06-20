import { notEmpty } from '@jbrowse/core/util'
import { transaction } from 'mobx'

import type { HierarchicalTrackSelectorModel } from '../HierarchicalTrackSelectorWidget/model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

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

/**
 * Derives the current selection state for the faceted grid and returns the
 * toggle handlers for the select-all and per-row checkboxes. In shopping-cart
 * mode "selected" means present in the selection set; otherwise it means the
 * track is shown on the view.
 */
export function getRowSelectionState({
  model,
  useShoppingCart,
  shownTrackIds,
  selection,
  filteredRows,
}: {
  model: HierarchicalTrackSelectorModel
  useShoppingCart: boolean
  shownTrackIds: Set<string>
  selection: AnyConfigurationModel[]
  filteredRows: { id: string }[]
}) {
  const selectedIds = useShoppingCart
    ? new Set(selection.map(s => `${s.trackId}`))
    : shownTrackIds
  const allSelected =
    filteredRows.length > 0 && filteredRows.every(row => selectedIds.has(row.id))
  const someSelected =
    !allSelected && filteredRows.some(row => selectedIds.has(row.id))

  return {
    selectedIds,
    allSelected,
    someSelected,
    toggleAll: () => {
      // allSelected implies every filtered row is selected, so deselect all;
      // otherwise select the rows that aren't yet selected
      const ids = allSelected
        ? filteredRows.map(row => row.id)
        : filteredRows
            .filter(row => !selectedIds.has(row.id))
            .map(row => row.id)
      setTracksSelected(model, ids, !allSelected, useShoppingCart)
    },
    toggleRow: (rowId: string) => {
      setTracksSelected(model, [rowId], !selectedIds.has(rowId), useShoppingCart)
    },
  }
}
