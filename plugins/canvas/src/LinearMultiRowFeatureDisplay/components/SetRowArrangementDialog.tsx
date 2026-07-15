import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { MultiRowSource } from '../sourcesLogic.ts'
import type { TreeLayoutModel } from '@jbrowse/tree-sidebar'

// A per-row `color` overrides that row's blocks at render time (over the
// worker-baked sampleColorMap / color slot / palette). Other use cases color
// per feature via the `color` slot, so leave rows uncolored to keep that.
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
  model: TreeLayoutModel<MultiRowSource>
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
