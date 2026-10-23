import { makeSizeSubMenu } from '@jbrowse/core/ui'
import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { categoryFilterItem } from '@jbrowse/display-kit/categoryFilter'
import AltRouteIcon from '@mui/icons-material/AltRoute'

import { DEFAULT_MIN_SASHIMI_READS } from '../../shared/alignmentsFilter.ts'

import type { JunctionFilter } from '../../shared/types.ts'
import type { SashimiPlacement } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const SASHIMI_PLACEMENT_OPTIONS: { value: SashimiPlacement; label: string }[] =
  [
    { value: 'auto', label: 'Auto (minimize overlap)' },
    { value: 'up', label: 'Above coverage' },
    { value: 'down', label: 'Below coverage' },
  ]

interface SashimiModel {
  showSashimi: boolean
  setShowSashimi: (show: boolean) => void
  showSashimiCounts: boolean
  setShowSashimiCounts: (show: boolean) => void
}

interface JunctionFiltersModel {
  showSashimi: boolean
  junctionFilter: JunctionFilter
  setJunctionFilter: (patch: Partial<JunctionFilter>) => void
}

interface SashimiPlacementModel {
  showSashimi: boolean
  showCoverage: boolean
  sashimiPlacement: SashimiPlacement
  setSashimiPlacement: (placement: SashimiPlacement) => void
}

// Checkboxes only, as in "Read connections": the junction filters live in
// "Filter by..." and the placement in "Advanced".
export function getSashimiMenuItem(model: SashimiModel) {
  const subMenu: MenuItem[] = [
    toggleItem('Show sashimi arcs', model.showSashimi, show => {
      model.setShowSashimi(show)
    }),
    ...(model.showSashimi
      ? [
          toggleItem('Show read counts', model.showSashimiCounts, show => {
            model.setShowSashimiCounts(show)
          }),
        ]
      : []),
  ]
  return {
    label: 'Sashimi arcs',
    icon: AltRouteIcon,
    type: 'subMenu' as const,
    subMenu,
  }
}

/** The `filter` rows on junctions, for "Filter by...", while the arcs draw. */
export function getJunctionFilterItems(
  model: JunctionFiltersModel,
): MenuItem[] {
  if (!model.showSashimi) {
    return []
  }
  return [
    categoryFilterItem(
      {
        noun: 'Non-canonical junctions',
        all: 'All junctions',
        only: 'Only non-canonical junctions',
        exclude: 'Hide non-canonical junctions',
        helpText:
          'Sashimi arcs whose intron does not begin and end with a canonical splice motif.',
      },
      model.junctionFilter.nonCanonical,
      nonCanonical => {
        model.setJunctionFilter({ nonCanonical })
      },
    ),
    makeSizeSubMenu({
      label: 'Min read support',
      title: 'Min reads at a junction',
      help: 'Hide a sashimi arc carried by fewer reads than this.',
      // Log-scale: support runs from small integers to thousands on deep
      // RNA-seq. 1 already shows every arc, since a junction has a read.
      scale: 'log',
      min: 1,
      max: 10_000,
      format: n => `${n}`,
      getValue: () => model.junctionFilter.minReads,
      isDefault: model.junctionFilter.minReads === DEFAULT_MIN_SASHIMI_READS,
      onChange: minReads => {
        model.setJunctionFilter({ minReads })
      },
      onReset: () => {
        model.setJunctionFilter({ minReads: DEFAULT_MIN_SASHIMI_READS })
      },
    }),
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
