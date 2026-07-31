import { checkboxItem, radioItems } from '@jbrowse/core/ui'

import { cytosineContextOptions } from '../../shared/modificationData.ts'

import type { ColorBy } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { CytosineContext } from '@jbrowse/modifications-utils'

// Bisulfite / EM-seq is reference-based (read-vs-reference C→T), so it needs no
// MM/ML tags and applies to any alignments display — it sits beside
// "Modifications" in the color menu rather than inside it, and in its own file
// for the same reason: it shares the cytosine-context vocabulary with the MM/ML
// submenu but none of its state, writer, or readiness gating.
//
// Picking a cytosine context activates it; CpG (context) and two-color (both
// defaults) are omitted from the scheme so a default session carries no
// redundant fields.

// The scheme is written whole on every click — no patch/merge step like the
// MM/ML submenu's — so this reads and writes the slot and nothing else.
interface BisulfiteModel {
  colorBy: ColorBy
  setColorScheme: (colorBy: ColorBy) => void
}

const DIVIDER: MenuItem = { type: 'divider' }

export function bisulfiteItem(model: BisulfiteModel): MenuItem {
  const isBis = model.colorBy.type === 'bisulfite'
  const mods = isBis ? (model.colorBy.modifications ?? {}) : {}
  const context = mods.cytosineContext ?? 'CG'
  const twoColor = !!mods.twoColor

  const setBisulfite = (
    nextContext: CytosineContext,
    nextTwoColor: boolean,
  ) => {
    model.setColorScheme({
      type: 'bisulfite',
      modifications: {
        ...(nextContext === 'CG' ? {} : { cytosineContext: nextContext }),
        ...(nextTwoColor ? { twoColor: true } : {}),
      },
    })
  }

  return {
    label: 'Bisulfite / EM-seq',
    helpText:
      'Reference-based methylation read from C→T conversion; needs no MM/ML tags. Methylated cytosines paint red, by cytosine context — turn on "Show unmethylated" to paint the converted sites blue as well.',
    subMenu: [
      ...radioItems<CytosineContext>(
        cytosineContextOptions,
        isBis ? context : undefined,
        next => {
          setBisulfite(next, twoColor)
        },
      ),
      ...(isBis
        ? [
            DIVIDER,
            checkboxItem(
              'Show unmethylated (blue)',
              twoColor,
              () => {
                setBisulfite(context, !twoColor)
              },
              {
                helpText:
                  'When on, the unmethylated (converted) sites paint blue as well as the methylated ones painting red. Off by default, so a track reads as presence/absence of methylation rather than a red/blue mix on every read.',
              },
            ),
          ]
        : []),
    ],
  }
}
