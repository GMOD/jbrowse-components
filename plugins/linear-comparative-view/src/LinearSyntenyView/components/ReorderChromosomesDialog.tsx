import { DiagonalizeDialog } from '@jbrowse/synteny-core'

import { runDiagonalize } from '../util/runDiagonalize.ts'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { DiagonalizeRunOpts } from '@jbrowse/synteny-core'

// Binds the shared re-order dialog to the stacked-rows reorder. Levels run
// outward from the anchor row and each is applied before the next, so every row
// is diagonalized against the neighbour nearer the anchor once that row has
// settled.
export default function ReorderChromosomesDialog({
  model,
  handleClose,
}: {
  model: LinearSyntenyViewModel
  handleClose: () => void
}) {
  return (
    <DiagonalizeDialog
      model={model}
      handleClose={handleClose}
      description="Reorders each assembly row to match its neighbour nearer the anchor row, using all alignment data across the currently displayed chromosomes."
      anchor={{
        rows: model.views.map(v => v.assemblyNames[0] ?? ''),
        value: model.diagonalizeAnchorRow,
        onChange: row => {
          model.setDiagonalizeAnchorRow(row)
        },
      }}
      run={(opts: DiagonalizeRunOpts) =>
        runDiagonalize(model, {
          ...opts,
          anchorRow: model.diagonalizeAnchorRow,
        })
      }
    />
  )
}
