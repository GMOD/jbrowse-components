import { rowLabels } from '@jbrowse/plugin-linear-genome-view'
import { DiagonalizeDialog } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { runDiagonalize } from '../util/runDiagonalize.ts'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { DiagonalizeRunOpts } from '@jbrowse/synteny-core'

const ReorderChromosomesDialog = observer(function ReorderChromosomesDialog({
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
        rows: rowLabels(model.views),
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
})

export default ReorderChromosomesDialog
