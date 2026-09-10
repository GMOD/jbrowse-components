import { DiagonalizeDialog } from '@jbrowse/synteny-core'

import { runCircularDiagonalize } from '../util/runCircularDiagonalize.ts'

import type { CircularViewModel } from '../model.ts'
import type { DiagonalizeRunOpts } from '@jbrowse/synteny-core'

// Binds the shared re-order dialog to the circle's reorder: the second genome's
// arc is laid out to follow the first, mirrored so each ribbon runs between
// neighboring arcs rather than across the middle.
export default function ReorderChromosomesDialog({
  model,
  handleClose,
}: {
  model: CircularViewModel
  handleClose: () => void
}) {
  return (
    <DiagonalizeDialog
      handleClose={handleClose}
      description="Reorders the second genome's chromosomes to follow the first, using all the alignment data across the chromosomes on the circle, and lays that genome out mirrored so its ribbons run between neighboring arcs."
      run={(opts: DiagonalizeRunOpts) => runCircularDiagonalize(model, opts)}
    />
  )
}
