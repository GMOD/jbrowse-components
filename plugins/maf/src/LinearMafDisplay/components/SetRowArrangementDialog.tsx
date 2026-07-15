import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { MafSource } from '../stateModel.ts'
import type { TreeLayoutModel } from '@jbrowse/tree-sidebar'

// MAF rows render no per-sample color (cells are colored by base), so the
// color column is reserved out — this is a reorder + relabel grid. Reordering
// clears the guide tree (rows would no longer line up with the dendrogram); the
// shared dialog warns about that when `willClearTree` returns true.
const RESERVED = new Set(['color'])
const NO_COLOR_COLUMNS: never[] = []

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
      colorColumns={NO_COLOR_COLUMNS}
      reservedFields={RESERVED}
    />
  )
}
