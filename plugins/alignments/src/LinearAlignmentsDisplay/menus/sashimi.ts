import { makeSizeSubMenu } from '@jbrowse/core/ui'
import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { categoryFilterItem } from '@jbrowse/display-kit/categoryFilter'

import {
  JUNCTION_CLASSES,
  junctionSource,
} from '../../features/sashimi/junctionClass.ts'
import { DEFAULT_MIN_SASHIMI_READS } from '../../shared/alignmentsFilter.ts'

import type { JunctionFilter, JunctionFilterPatch } from '../../shared/types.ts'
import type { SashimiPlacement } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const SASHIMI_PLACEMENT_OPTIONS: { value: SashimiPlacement; label: string }[] =
  [
    { value: 'auto', label: 'Auto (minimize overlap)' },
    { value: 'up', label: 'Above coverage' },
    { value: 'down', label: 'Below coverage' },
  ]

interface JunctionFiltersModel {
  showSashimi: boolean
  junctionFilter: JunctionFilter
  setJunctionFilter: (patch: JunctionFilterPatch) => void
}

export interface SashimiModel extends JunctionFiltersModel {
  setShowSashimi: (show: boolean) => void
  showSashimiCounts: boolean
  setShowSashimiCounts: (show: boolean) => void
}

const SPLIT_CLASSES = JUNCTION_CLASSES.filter(
  c => junctionSource(c) === 'split',
)

// Unchecking writes `junction.source` gap; checking clears it, widening a
// `junction.class` that admits no split class so the box reads checked.
function splitJunctionsItem(model: JunctionFiltersModel) {
  const { classes } = model.junctionFilter
  return toggleItem(
    'Junctions from split reads',
    !classes || classes.some(c => SPLIT_CLASSES.includes(c)),
    show => {
      model.setJunctionFilter(
        show
          ? { classes: [...new Set([...(classes ?? []), ...SPLIT_CLASSES])] }
          : { sources: ['gap'] },
      )
    },
    {
      helpText:
        'Count the junctions that split alignments (SA tag) imply beside the spliced (N) ones.',
    },
  )
}

interface SashimiPlacementModel {
  showSashimi: boolean
  showCoverage: boolean
  sashimiPlacement: SashimiPlacement
  setSashimiPlacement: (placement: SashimiPlacement) => void
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
 * The `filter` rows on junctions, for "Filter by...", while the arcs draw:
 * whether split-read junctions join the N-gap splices, then the class and
 * support floors.
 */
export function getJunctionFilterItems(
  model: JunctionFiltersModel,
): MenuItem[] {
  if (!model.showSashimi) {
    return []
  }
  return [
    splitJunctionsItem(model),
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
