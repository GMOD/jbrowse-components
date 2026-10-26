import { checkboxItem, radioItem } from '@jbrowse/core/ui/menuItems'

import {
  MODIFICATIONS_LABEL,
  UNMODIFIED_IN_BLUE_LABEL,
} from './baseLayerLabels.ts'

import type { BaseLayer, BasesFilter, BasesPatch } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The MM/ML modification layer's radio in Color by. It leaves `unmodified`
// and `filter` alone, so switching layers keeps the blue view and the
// Filter by refinements (basesFilterMenu.ts). Reference-based bisulfite is
// the sibling radio, in bisulfiteMenu.ts.
export interface ModificationsMenuModel {
  baseLayer: BaseLayer | undefined
  basesFilter: BasesFilter
  setBases: (patch: BasesPatch) => void
  detectedModificationTypes: string[]
}

export function modificationsRadio(model: ModificationsMenuModel): MenuItem {
  return radioItem(
    MODIFICATIONS_LABEL,
    model.baseLayer?.field === 'modifications',
    () => {
      model.setBases({ show: true, field: 'modifications' })
    },
  )
}

/**
 * The not-modified side in blue (IGV's "2-color") for whichever methylation
 * layer draws: unmodified calls under Modifications, unconverted cytosines
 * under bisulfite. Offered only while one of them draws.
 */
export function unmodifiedInBlueItems(model: {
  baseLayer: BaseLayer | undefined
  setBases: (patch: BasesPatch) => void
}): MenuItem[] {
  const layer = model.baseLayer
  return layer?.field === 'modifications' || layer?.field === 'bisulfite'
    ? [
        checkboxItem(UNMODIFIED_IN_BLUE_LABEL, layer.unmodified, () => {
          model.setBases({ unmodified: !layer.unmodified })
        }),
      ]
    : []
}
