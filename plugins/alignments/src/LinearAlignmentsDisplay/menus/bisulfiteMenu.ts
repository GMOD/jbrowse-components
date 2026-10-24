import { checkboxItem, radioItems } from '@jbrowse/core/ui/menuItems'

import { contextEntries } from '../../shared/basesFilter.ts'
import { cytosineContextOptions } from '../../shared/modificationData.ts'

import type { BaseLayer, BasesFilter, BasesPatch } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { CytosineContext } from '@jbrowse/modifications-utils'

// Bisulfite / EM-seq is reference-based (read-vs-reference C→T), so it needs no
// MM/ML tags and applies to any alignments display — it sits beside
// "Modifications" in the color menu rather than inside it, and skips that
// submenu's readiness gating.
//
// Picking a cytosine context activates it. `pileup.bases.filter` is shared
// with the MM/ML layer, so a click writes its `context` alone, keeping that
// layer's probability floor and codes.
interface BisulfiteModel {
  baseLayer: BaseLayer | undefined
  basesFilter: BasesFilter
  setBases: (patch: BasesPatch) => void
}

const DIVIDER: MenuItem = { type: 'divider' }

export function bisulfiteItem(model: BisulfiteModel): MenuItem {
  const layer = model.baseLayer
  const isBis = layer?.field === 'bisulfite'
  const twoColor = isBis && layer.unmodified

  return {
    label: 'Bisulfite / EM-seq',
    subMenu: [
      ...radioItems<CytosineContext>(
        cytosineContextOptions,
        isBis ? model.basesFilter.context : undefined,
        next => {
          model.setBases({
            show: true,
            field: 'bisulfite',
            filter: { context: contextEntries(next) },
          })
        },
      ),
      ...(isBis
        ? [
            DIVIDER,
            checkboxItem('Show unmethylated (blue)', twoColor, () => {
              model.setBases({ unmodified: !twoColor })
            }),
          ]
        : []),
    ],
  }
}
