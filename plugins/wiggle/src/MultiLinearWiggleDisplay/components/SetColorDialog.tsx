import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { Source } from '../../util.ts'
import type { ColorColumn, TreeLayoutModel } from '@jbrowse/tree-sidebar'

const COLOR_COLUMNS: ColorColumn<Source>[] = [
  {
    field: 'color',
    headerName: 'Track color',
    bulkLabel: 'Change track color of selected',
  },
  {
    field: 'labelColor',
    headerName: 'Label color',
    bulkLabel: 'Change label color of selected',
  },
]

// Seed from `editableSources` (not `sources`) so overlay-palette synthesis
// doesn't bake unset colors into the persisted layout on Submit. setLayout
// already clears the cluster tree on reorder (via willClearTree), but the
// warning dialog surfaces that destruction to the user first.
export default function MultiWiggleSetColorDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<Source>
  handleClose: () => void
}) {
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title="Multi-wiggle color/arrangement editor"
      colorColumns={COLOR_COLUMNS}
      enableBulkEdit
      enableRowPalettizer
      showTipsStorageKey="multiwiggle-showTips"
    />
  )
}
