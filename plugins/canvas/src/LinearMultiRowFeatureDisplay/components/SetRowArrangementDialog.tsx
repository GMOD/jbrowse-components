import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { MultiRowSource } from '../sourcesLogic.ts'
import type { TreeLayoutModel } from '@jbrowse/tree-sidebar'

// Per-row color isn't used (block colors come per feature), so the color column
// is suppressed; the dialog edits row order / labels / subtree only.
const RESERVED = new Set(['color'])
const NO_COLOR_COLUMNS: never[] = []

export default function SetRowArrangementDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<MultiRowSource>
  handleClose: () => void
}) {
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title="Multi-row painting — row arrangement"
      colorColumns={NO_COLOR_COLUMNS}
      reservedFields={RESERVED}
    />
  )
}
