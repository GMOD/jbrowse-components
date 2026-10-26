import {
  checkboxItem,
  makeRadioSubMenu,
  radioItem,
} from '@jbrowse/core/ui/menuItems'

import {
  DEFAULT_BASES_FILTER,
  contextEntries,
} from '../../shared/basesFilter.ts'
import { cytosineContextOptions } from '../../shared/modificationData.ts'
import {
  CYTOSINE_CONTEXT_LABEL,
  MODIFICATIONS_LABEL,
  UNMODIFIED_IN_BLUE_LABEL,
} from './baseLayerLabels.ts'

import type { BaseLayer, BasesFilter, BasesPatch } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The MM/ML modification layer's radio in Color by. It leaves `unmodified`
// and `filter` alone, so switching layers keeps the blue view, the cytosine
// context and the More filters... refinements. Reference-based bisulfite is
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

/**
 * Which cytosines the methylation coloring scores, while a coloring reads it:
 * bisulfite always, and the blue view of 5mC/5hmC calls, which paints every
 * cytosine in context. Detection resets per fetch, so the blue view keeps the
 * row until detection has finished and found no cytosine calls, and always
 * while a non-default context is in force.
 */
export function cytosineContextItems(
  model: ModificationsMenuModel & { modificationsReady: boolean },
): MenuItem[] {
  const layer = model.baseLayer
  const { context } = model.basesFilter
  const cytosineCalls = model.detectedModificationTypes.some(
    k => k === 'm' || k === 'h',
  )
  const applies =
    layer?.field === 'bisulfite' ||
    (layer?.field === 'modifications' &&
      layer.unmodified &&
      (cytosineCalls ||
        !model.modificationsReady ||
        context !== DEFAULT_BASES_FILTER.context))
  return applies
    ? [
        makeRadioSubMenu({
          label: CYTOSINE_CONTEXT_LABEL,
          value: context,
          options: cytosineContextOptions.map(o => [o.value, o.label] as const),
          onChange: next => {
            model.setBases({
              filter: {
                context:
                  next === DEFAULT_BASES_FILTER.context
                    ? undefined
                    : contextEntries(next),
              },
            })
          },
        }),
      ]
    : []
}
