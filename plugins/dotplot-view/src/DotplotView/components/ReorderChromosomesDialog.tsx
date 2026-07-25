import { DiagonalizeDialog } from '@jbrowse/synteny-core'

import { runDotplotDiagonalize } from '../util/runDotplotDiagonalize.ts'

import type { DotplotViewModel } from '../model.ts'
import type { DiagonalizeRunOpts } from '@jbrowse/synteny-core'

// Binds the shared re-order dialog to the dotplot reorder, which moves the
// vertical axis only — the horizontal axis is the fixed reference.
export default function ReorderChromosomesDialog({
  model,
  handleClose,
}: {
  model: DotplotViewModel
  handleClose: () => void
}) {
  return (
    <DiagonalizeDialog
      handleClose={handleClose}
      description="Reorders the vertical axis to match the horizontal, using all alignments across the currently displayed chromosomes."
      run={(opts: DiagonalizeRunOpts) => runDotplotDiagonalize(model, opts)}
    />
  )
}
