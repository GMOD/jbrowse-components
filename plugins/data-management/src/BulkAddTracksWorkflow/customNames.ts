import { withEditedName, withoutName } from './util.ts'

import type { AddTrackModel } from '../AddTrackWidget/model.ts'

/**
 * The names the user typed over the automatic ones, keyed by row id (the data
 * file's location), plus the two edits the UI makes to them: renaming a row,
 * and forgetting a row that was removed so a later re-add of the same URL
 * starts from the automatic name rather than resurrecting the old edit.
 *
 * Held on the widget model with the rest of the bulk input, so a rename
 * outlives the drawer unmounting the workflow. Owning the map here keeps its
 * shape out of the preview table, which only ever renames one row at a time.
 */
export function customNames(model: AddTrackModel) {
  return {
    customNames: model.bulk.customNames,

    renameRow(args: { id: string; name: string; autoName: string }) {
      model.updateBulkInput({
        customNames: withEditedName({
          customNames: model.bulk.customNames,
          ...args,
        }),
      })
    },

    forgetRow(id: string) {
      model.updateBulkInput({
        customNames: withoutName(model.bulk.customNames, id),
      })
    },
  }
}

export type CustomNamesState = ReturnType<typeof customNames>
