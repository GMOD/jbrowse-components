import { useState } from 'react'

import { withEditedName, withoutName } from './util.ts'

/**
 * The names the user typed over the automatic ones, keyed by row id (the data
 * file's location), plus the two edits the UI makes to them: renaming a row,
 * and forgetting a row that was removed so a later re-add of the same URL
 * starts from the automatic name rather than resurrecting the old edit.
 *
 * Owning the map here keeps its shape out of the preview table, which only ever
 * renames one row at a time.
 */
export function useCustomNames() {
  const [customNames, setCustomNames] = useState<Record<string, string>>({})

  return {
    customNames,

    renameRow(args: { id: string; name: string; autoName: string }) {
      setCustomNames(prev => withEditedName({ customNames: prev, ...args }))
    },

    forgetRow(id: string) {
      setCustomNames(prev => withoutName(prev, id))
    },
  }
}

export type CustomNamesState = ReturnType<typeof useCustomNames>
