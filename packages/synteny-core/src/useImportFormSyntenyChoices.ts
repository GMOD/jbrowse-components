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
 *
 * Indexed by pair position and moved by `remap`, which takes the permutation
 * `remapImportFormSelections` just applied — so a choice ends up wherever that
 * pair's selection ended up. Keying on the pair's assemblies instead looks
 * simpler and is wrong on the stack that needs it most: a self-alignment carries
 * one assembly on every row, so every band would share one entry.
 */
export function useImportFormSyntenyChoices(model: ImportFormSyntenyModel) {
  const [byPair, setByPair] = useState<Record<number, string>>({})

  return {
    /** move each pair's choice to where that pair's selection went */
    remap(movedFrom: (number | undefined)[]) {
      setByPair(prev =>
        Object.fromEntries(
          movedFrom.flatMap((from, to) => {
            const choice = from === undefined ? undefined : prev[from]
            return choice === undefined ? [] : [[to, choice]]
          }),
        ),
      )
    },
    forPair(rowIndex: number) {
      return {
        choice:
          byPair[rowIndex] ??
          derivedChoice(model.importFormSyntenyTrackSelections[rowIndex]),
        setChoice(choice: string) {
          setByPair(prev => ({ ...prev, [rowIndex]: choice }))
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
