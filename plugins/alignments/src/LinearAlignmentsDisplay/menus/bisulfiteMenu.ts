import { radioItem } from '@jbrowse/core/ui/menuItems'

import {
  BISULFITE_LABEL,
  BISULFITE_TWO_COLOR_LABEL,
} from './baseLayerLabels.ts'

import type { BaseLayer, BasesPatch } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Bisulfite / EM-seq reads methylation off the C→T conversion against the
// reference, so it needs no MM/ML tags, applies to any alignments display and
// skips the modification radios' readiness gating. Its cytosine context is a
// Filter by... row (basesFilterMenu.ts), shared with the MM/ML layer.
interface BisulfiteModel {
  baseLayer: BaseLayer | undefined
  setBases: (patch: BasesPatch) => void
}

export function bisulfiteRadios(model: BisulfiteModel): MenuItem[] {
  const layer = model.baseLayer
  const isBis = layer?.field === 'bisulfite'
  const twoColor = isBis && layer.unmodified
  const pick = (unmodified: boolean) => () => {
    model.setBases({ show: true, field: 'bisulfite', unmodified })
  }
  return [
    radioItem(BISULFITE_LABEL, isBis && !twoColor, pick(false)),
    radioItem(BISULFITE_TWO_COLOR_LABEL, twoColor, pick(true)),
  ]
}
