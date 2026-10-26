import { radioItem } from '@jbrowse/core/ui/menuItems'

import { BISULFITE_LABEL } from './baseLayerLabels.ts'

import type { BaseLayer, BasesPatch } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Bisulfite / EM-seq reads methylation off the C→T conversion against the
// reference, so it needs no MM/ML tags, applies to any alignments display and
// skips the modification radio's readiness gating. Its cytosine context is a
// Filter by row (basesFilterMenu.ts), shared with the MM/ML layer.
interface BisulfiteModel {
  baseLayer: BaseLayer | undefined
  setBases: (patch: BasesPatch) => void
}

export function bisulfiteRadio(model: BisulfiteModel): MenuItem {
  return radioItem(
    BISULFITE_LABEL,
    model.baseLayer?.field === 'bisulfite',
    () => {
      model.setBases({ show: true, field: 'bisulfite' })
    },
  )
}
