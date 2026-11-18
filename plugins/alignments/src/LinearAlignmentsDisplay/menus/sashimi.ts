import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { categoryFilterItem } from '@jbrowse/display-kit/categoryFilter'

import { junctionEntries } from '../../shared/alignmentsFilter.ts'

import type { JunctionFilter } from '../../shared/types.ts'
import type { SashimiPlacement } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { FieldsPatch } from '@jbrowse/core/util/fieldPredicate'

const SASHIMI_PLACEMENT_OPTIONS: { value: SashimiPlacement; label: string }[] =
  [
    { value: 'auto', label: 'Auto (minimize overlap)' },
    { value: 'overlay', label: 'Over coverage' },
    { value: 'above', label: 'Above coverage' },
    { value: 'below', label: 'Below coverage' },
  ]

export interface SashimiModel {
  showSashimi: boolean
  setShowSashimi: (show: boolean) => void
  showSashimiLabels: boolean
  setShowSashimiLabels: (show: boolean) => void
}

interface SashimiPlacementModel {
  showSashimi: boolean
  sashimiPlacement: SashimiPlacement
  setSashimiPlacement: (placement: SashimiPlacement) => void
}

interface JunctionFilterModel {
  showSashimi: boolean
  junctionFilter: JunctionFilter
  setFilterFields: (patch: FieldsPatch) => void
}

/**
 * The everyday junction filter, for "Filter by", while the arcs draw. The
 * split-read and min-reads filters are in the "More filters..." dialog.
 */
export function getJunctionFilterItems(model: JunctionFilterModel): MenuItem[] {
  return model.showSashimi
    ? [
        categoryFilterItem(
          {
            noun: 'Non-canonical junctions',
            all: 'All junctions',
            only: 'Only non-canonical junctions',
            exclude: 'Hide non-canonical junctions',
            helpText:
              'Junctions whose splice-site dinucleotides, read off the ' +
              'reference, are none of GT-AG, GC-AG or AT-AC. A junction whose ' +
              'ends were not read counts as canonical.',
          },
          model.junctionFilter.nonCanonical,
          nonCanonical => {
            model.setFilterFields(junctionEntries({ nonCanonical }))
          },
        ),
      ]
    : []
}

/** The arcs' rows in "Show": the arcs, and while they draw their counts. */
export function sashimiShowItems(model: SashimiModel): MenuItem[] {
  return [
    toggleItem('Show junctions', model.showSashimi, show => {
      model.setShowSashimi(show)
    }),
    ...(model.showSashimi
      ? [
          toggleItem(
            'Show junction read counts',
            model.showSashimiLabels,
            show => {
              model.setShowSashimiLabels(show)
            },
          ),
        ]
      : []),
  ]
}

/**
 * The placement row, for "Advanced", while the arcs draw. It stays without the
 * coverage band, where the choice is still between the strip above, arcs
 * rising, and the strip below.
 */
export function getSashimiPlacementItems(
  model: SashimiPlacementModel,
): MenuItem[] {
  return model.showSashimi
    ? [
        {
          label: 'Junction placement',
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
