import { useState } from 'react'

import type {
  ImportFormSyntenyModel,
  ImportFormSyntenyTrack,
} from './SelectorTypes.ts'

/**
 * The radio a stored selection implies. Right for the three built-ins and for
 * nothing else, which is why it is the fallback rather than the whole answer —
 * see useImportFormSyntenyChoices.
 */
function derivedChoice(selection: ImportFormSyntenyTrack | undefined) {
  return selection?.type === 'none'
    ? 'none'
    : selection?.type === 'userOpened'
      ? 'custom'
      : 'tracklist'
}

// A pair of assemblies, order-insensitively, as the identity of the radio choice
// made for it. Same rule remapSelectionsToPairs matches selections by — a
// synteny track answers in either direction — so a choice follows its pair
// through a row edit exactly as far as the selection does, and no further,
// without either of them knowing about the other.
//
// Two row pairs over the same two assemblies share an entry. That is the wart
// the selection remap already has for the same reason, and here it costs a radio
// rather than a track.
function pairKey(assembly1: string, assembly2: string) {
  return [assembly1, assembly2].sort().join(' ')
}

/**
 * Which radio each row pair of an import form has selected — held by the FORM,
 * not by the panel that draws it. The panel is deliberately remounted per pair
 * (its uploader and any plugin body hold local state that has to reset), and the
 * choice is the one thing that has to survive that.
 *
 * Rebuilding it from the stored selection is the fallback, not the answer. That
 * derivation is exact for None / Existing track / New track, and cannot be for a
 * plugin's own option: picking one stores a plain `none` so the plugin's
 * component owns the slot from there, and the moment the plugin writes the track
 * it built, the slot reads back as "New track". So visiting another pair and
 * returning replaced the plugin's panel with the built-in uploader, standing
 * over a selection the plugin had already made.
 */
export function useImportFormSyntenyChoices(model: ImportFormSyntenyModel) {
  const [byPair, setByPair] = useState<Record<string, string>>({})

  return {
    forPair(rowIndex: number, assembly1: string, assembly2: string) {
      const key = pairKey(assembly1, assembly2)
      return {
        choice:
          byPair[key] ??
          derivedChoice(model.importFormSyntenyTrackSelections[rowIndex]),
        setChoice(choice: string) {
          setByPair(prev => ({ ...prev, [key]: choice }))
          // every choice writes the slot, so whichever body owns it from here
          // starts from a known state — an extension option included, which
          // holds `none` until the plugin puts a track there
          model.setImportFormSyntenyTrack(
            rowIndex,
            choice === 'tracklist'
              ? { type: 'preConfigured', value: '' }
              : choice === 'custom'
                ? { type: 'userOpened' }
                : { type: 'none' },
          )
        },
      }
    },
  }
}

/** what `useImportFormSyntenyChoices` hands back, for a form that passes it down */
export type ImportFormSyntenyChoices = ReturnType<
  typeof useImportFormSyntenyChoices
>
