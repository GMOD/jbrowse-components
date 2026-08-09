import { useState } from 'react'

import type { ImportFormSyntenyModel } from './SelectorTypes.ts'

/**
 * The radio choice ('none' | 'tracklist' | 'custom' | an extension option) for
 * one import-form row, kept in sync with the model. Initialized from the row's
 * existing selection: `userOpened` reads back as "New track" and everything else
 * as its own radio, except an extension option, which stores a plain `none` and
 * so reads back as "None". Selecting "tracklist" seeds an empty preConfigured
 * slot and "custom" a valueless userOpened slot (the pending upload, which the
 * form flags as unconfigured until a file is chosen); every other choice clears
 * to "none" so the relevant body component owns the model from there.
 */
export function useImportFormSyntenyChoice(
  model: ImportFormSyntenyModel,
  rowIndex: number,
) {
  const [choice, setChoice] = useState(() => {
    const selection = model.importFormSyntenyTrackSelections[rowIndex]
    return selection?.type === 'none'
      ? 'none'
      : selection?.type === 'userOpened'
        ? 'custom'
        : 'tracklist'
  })

  function handleChange(val: string) {
    setChoice(val)
    model.setImportFormSyntenyTrack(
      rowIndex,
      val === 'tracklist'
        ? { type: 'preConfigured', value: '' }
        : val === 'custom'
          ? { type: 'userOpened' }
          : { type: 'none' },
    )
  }

  return { choice, setChoice: handleChange }
}
