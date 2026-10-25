import { radioItem } from '@jbrowse/core/ui/menuItems'

import {
  MODIFICATIONS_LABEL,
  MODIFICATIONS_TWO_COLOR_LABEL,
} from './baseLayerLabels.ts'

import type { BaseLayer, BasesFilter, BasesPatch } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The MM/ML modification layer's two radios in Color by...: the calls in one
// color per type, or the same plus the not-modified side in blue (IGV's
// "2-color"). Each writes `pileup.bases.unmodified` and leaves `filter` alone,
// so switching views keeps the Filter by... refinements (basesFilterMenu.ts).
// Reference-based bisulfite is the sibling pair, in bisulfiteMenu.ts.
export interface ModificationsMenuModel {
  baseLayer: BaseLayer | undefined
  basesFilter: BasesFilter
  setBases: (patch: BasesPatch) => void
  detectedModificationTypes: string[]
}

export function modificationsRadios(model: ModificationsMenuModel): MenuItem[] {
  const layer = model.baseLayer
  const isActive = layer?.field === 'modifications'
  const byTwoColor = isActive && layer.unmodified
  const pick = (unmodified: boolean) => () => {
    model.setBases({ show: true, field: 'modifications', unmodified })
  }
  return [
    radioItem(MODIFICATIONS_LABEL, isActive && !byTwoColor, pick(false)),
    radioItem(MODIFICATIONS_TWO_COLOR_LABEL, byTwoColor, pick(true)),
  ]
}
