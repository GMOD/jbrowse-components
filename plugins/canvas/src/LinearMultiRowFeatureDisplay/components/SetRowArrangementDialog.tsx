import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { RowSource, TreeLayoutModel } from '@jbrowse/tree-sidebar'

// A per-row `color` overrides that row's blocks at render time, over the
// worker-baked per-feature color.
const COLOR_COLUMNS = [
  {
    field: 'color' as const,
    headerName: 'Row color',
    bulkLabel: 'Change color of selected rows',
  },
]

export default function SetRowArrangementDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<RowSource>
  handleClose: () => void
}) {
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title="Multi-row painting — colors & arrangement"
      colorColumns={COLOR_COLUMNS}
      enableBulkEdit
      enableRowPalettizer
    />
  )
}
