import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { categoryFilterItem } from '@jbrowse/display-kit/categoryFilter'

import { junctionEntries } from '../../shared/alignmentsFilter.ts'

import type { JunctionFilter } from '../../shared/types.ts'
import type { SashimiPlacement } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

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

interface JunctionFilterModel {
  showSashimi: boolean
  junctionFilter: JunctionFilter
  setFilterFields: (
    patch: Readonly<Record<string, readonly FieldPredicate[] | undefined>>,
  ) => void
}

/**
 * The everyday junction filter, for "Filter by...", while the arcs draw. The
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
          },
          model.junctionFilter.nonCanonical,
          nonCanonical => {
            model.setFilterFields(junctionEntries({ nonCanonical }))
          },
        ),
      ]
    : []
}

/** The arcs' rows in "Show...": the arcs, and while they draw their counts. */
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
