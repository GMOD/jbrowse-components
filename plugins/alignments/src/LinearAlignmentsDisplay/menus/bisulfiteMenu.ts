import { checkboxItem, radioItems } from '@jbrowse/core/ui/menuItems'

import { cytosineContextOptions } from '../../shared/modificationData.ts'

import type { BaseLayer, ModificationColorBy } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { CytosineContext } from '@jbrowse/modifications-utils'

// Bisulfite / EM-seq is reference-based (read-vs-reference C→T), so it needs no
// MM/ML tags and applies to any alignments display — it sits beside
// "Modifications" in the color menu rather than inside it, and in its own file
// for the same reason: it shares the cytosine-context vocabulary with the MM/ML
// submenu but none of its state, writer, or readiness gating.
//
// Picking a cytosine context activates it. The `modifications` slot is shared
// with the MM/ML layer, so a click merges its two members into the slot rather
// than replacing it, keeping that layer's threshold and type filter.
interface BisulfiteModel {
  baseLayer: BaseLayer | undefined
  modificationSettings: ModificationColorBy
  setBaseLayer: (layer?: BaseLayer) => void
}

const DIVIDER: MenuItem = { type: 'divider' }

export function bisulfiteItem(model: BisulfiteModel): MenuItem {
  const isBis = model.baseLayer?.type === 'bisulfite'
  const mods = model.modificationSettings
  const context = mods.cytosineContext ?? 'CG'
  const twoColor = isBis && !!mods.twoColor

  const setBisulfite = (
    nextContext: CytosineContext,
    nextTwoColor: boolean,
  ) => {
    model.setBaseLayer({
      type: 'bisulfite',
      modifications: {
        ...mods,
        cytosineContext: nextContext,
        twoColor: nextTwoColor,
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
