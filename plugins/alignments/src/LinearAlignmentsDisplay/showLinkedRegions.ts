import { showRegionsWithUndo } from '@jbrowse/plugin-linear-genome-view'

import type { AlignmentsUnit } from './constants.ts'
import type { Region } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface UnitDisplay {
  unit: AlignmentsUnit
  setUnit: (unit: AlignmentsUnit) => void
}

/**
 * Replace the view's displayed regions with the loci of one read's pieces, in
 * chain layout: the point of putting them side by side is the connector
 * between them, and Undo puts the layout back with the regions.
 */
export function showLinkedRegionsWithUndo({
  view,
  display,
  regions,
  message,
}: {
  view: LinearGenomeViewModel
  display: UnitDisplay
  regions: Region[]
  message: string
}) {
  const wasLinked = display.unit === 'chain'
  if (!wasLinked) {
    display.setUnit('chain')
  }
  showRegionsWithUndo({
    view,
    regions,
    message,
    alsoUndo: wasLinked
      ? undefined
      : () => {
          display.setUnit('read')
        },
  })
}
