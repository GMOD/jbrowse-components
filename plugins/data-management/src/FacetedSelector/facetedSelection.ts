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
    if (selected) {
      model.addToSelection(ids)
    } else {
      model.removeFromSelection(ids)
    }
  } else if (selected) {
    // A display's state model may still be a dynamic import away, so the shows
    // cannot sit inside a transaction — they are awaited one at a time, which
    // also keeps the tracks in the order the caller listed them. Only the
    // bookkeeping is still batched.
    const { trackContainer } = model
    void (async () => {
      for (const id of ids) {
        await trackContainer?.launchTrack(id)
      }
      transaction(() => {
        for (const id of ids) {
          model.addToRecentlyUsed(id)
        }
      })
    })()
  } else {
    transaction(() => {
      for (const id of ids) {
        model.trackContainer?.hideTrack(id)
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
  selectionSet,
  filteredRows,
}: {
  model: HierarchicalTrackSelectorModel
  useShoppingCart: boolean
  shownTrackIds: Set<string>
  selectionSet: Set<string>
  filteredRows: { id: string }[]
}) {
  const selectedIds = useShoppingCart ? selectionSet : shownTrackIds
  const allSelected =
    filteredRows.length > 0 &&
    filteredRows.every(row => selectedIds.has(row.id))
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
      setTracksSelected(
        model,
        [rowId],
        !selectedIds.has(rowId),
        useShoppingCart,
      )
    },
  }
}
