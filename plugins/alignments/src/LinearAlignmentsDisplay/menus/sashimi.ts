import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'

import type { SashimiPlacement } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const SASHIMI_PLACEMENT_OPTIONS: { value: SashimiPlacement; label: string }[] =
  [
    { value: 'auto', label: 'Auto (minimize overlap)' },
    { value: 'up', label: 'Above coverage' },
    { value: 'down', label: 'Below coverage' },
  ]

export interface SashimiModel {
  showSashimi: boolean
  setShowSashimi: (show: boolean) => void
  showSashimiCounts: boolean
  setShowSashimiCounts: (show: boolean) => void
}

interface SashimiPlacementModel {
  showSashimi: boolean
  showCoverage: boolean
  sashimiPlacement: SashimiPlacement
  setSashimiPlacement: (placement: SashimiPlacement) => void
}

/**
 * The arcs' rows in "Show...": the arcs, and while they draw their counts.
 * Their junction filters are in the "More filters..." dialog.
 */
export function sashimiShowItems(model: SashimiModel): MenuItem[] {
  return [
    toggleItem('Sashimi arcs', model.showSashimi, show => {
      model.setShowSashimi(show)
    }),
    ...(model.showSashimi
      ? [
          toggleItem('Sashimi read counts', model.showSashimiCounts, show => {
            model.setShowSashimiCounts(show)
          }),
        ]
      : []),
  ]
}

/**
 * The placement row, for "Advanced". Without the coverage band the arcs draw
 * in a strip of their own, so there is nothing to place.
 */
export function getSashimiPlacementItems(
  model: SashimiPlacementModel,
): MenuItem[] {
  return model.showSashimi && model.showCoverage
    ? [
        {
          label: 'Sashimi placement',
          type: 'subMenu' as const,
          subMenu: radioItems(
            SASHIMI_PLACEMENT_OPTIONS,
            model.sashimiPlacement,
            placement => {
              model.setSashimiPlacement(placement)
            },
          ),
        },
      ]
    : []
}
