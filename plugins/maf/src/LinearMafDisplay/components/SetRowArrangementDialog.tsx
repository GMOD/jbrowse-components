import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { MafSource } from '../stateModel.ts'
import type { TreeLayoutModel } from '@jbrowse/tree-sidebar'

/**
 * Reorder, relabel and recolor the species rows.
 *
 * A reorder no rotation of the guide tree produces hides it, and the shared
 * dialog warns when `rowOrderWillDropTree` says so.
 */
export default function SetRowArrangementDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<MafSource>
  handleClose: () => void
}) {
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title="MAF display — row arrangement"
    />
  )
}
