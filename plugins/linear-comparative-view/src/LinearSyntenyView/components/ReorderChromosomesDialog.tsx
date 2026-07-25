import { DiagonalizeDialog } from '@jbrowse/synteny-core'

import { runDiagonalize } from '../util/runDiagonalize.ts'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { DiagonalizeRunOpts } from '@jbrowse/synteny-core'

// Binds the shared re-order dialog to the stacked-rows reorder. Levels run
// top-down and each is applied before the next, so every row is diagonalized
// against the row above it once that row has settled.
export default function ReorderChromosomesDialog({
  model,
  handleClose,
}: {
  model: LinearSyntenyViewModel
  handleClose: () => void
}) {
  return (
    <DiagonalizeDialog
      handleClose={handleClose}
      description="Reorders each assembly row to match the row above it, using all alignment data across the currently displayed chromosomes."
      run={(opts: DiagonalizeRunOpts) => runDiagonalize(model, opts)}
    />
  )
}
