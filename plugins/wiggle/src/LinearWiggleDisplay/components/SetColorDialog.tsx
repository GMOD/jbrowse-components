import { SetColorDialog } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import type { Source } from '../../util.ts'
import type { ColorColumn, TreeLayoutModel } from '@jbrowse/tree-sidebar'

// The one colour a reader sets on a row: its plot, or under a score gradient
// the tint beside its label, which is where a row's identity paints in that
// mode. See the channel table in sourcesLogic.ts; this dialog re-decides none
// of it, and `applyRowEdits` writes the edited channel to `rowColor`.
const ROW_COLOR: ColorColumn<Source> = {
  field: 'color',
  headerName: 'Color',
  bulkLabel: 'Change color of selected',
}

const LABEL_TINT: ColorColumn<Source> = {
  field: 'labelColor',
  headerName: 'Color',
  bulkLabel: 'Change color of selected',
}

// The channel the mode does not edit still rides on the rows, from the adapter
// or from an earlier sitting in the other mode; reserved so the grid neither
// offers it as a raw hex column nor the palettizer as a key.
const RESERVED = new Set(['color', 'labelColor'])

export default observer(function WiggleSetColorDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<Source> & {
    scoreGradientPaints: boolean
    isRowLayout: boolean
  }
  handleClose: () => void
}) {
  const tintsLabel = model.scoreGradientPaints && model.isRowLayout
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title="Wiggle color/arrangement editor"
      colorColumns={[tintsLabel ? LABEL_TINT : ROW_COLOR]}
      reservedFields={RESERVED}
      enableBulkEdit
      enableRowPalettizer
    />
  )
})
