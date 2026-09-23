import { SetColorDialog } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import type { Source } from '../../util.ts'
import type { ColorColumn, TreeLayoutModel } from '@jbrowse/tree-sidebar'

const TRACK_COLOR: ColorColumn<Source> = {
  field: 'color',
  headerName: 'Track color',
  bulkLabel: 'Change track color of selected',
}

// Row-label sidebar tint, and under a score gradient the channel a row's
// identity color lives in — which is why it is the default column there. See
// the color-model table in sourcesLogic.ts; this dialog does not re-decide any
// of it.
const LABEL_COLOR: ColorColumn<Source> = {
  field: 'labelColor',
  headerName: 'Label color',
  bulkLabel: 'Change label color of selected',
}

// Sources sharing one plot have no row-label sidebar, so they get no Label
// color column — but the rows still carry `labelColor` (a leftover from a
// faceted sitting, or a still-applying value if the user facets again). Reserve
// it so the grid doesn't fall back to rendering it as a raw hex text column.
const OVERLAY_RESERVED: ReadonlySet<string> = new Set(['labelColor'])

// Seed from `editableSources` (not `sources`) so overlay-palette synthesis
// doesn't bake unset colors into the persisted layout on Submit. setRowOrder
// already clears the cluster tree on reorder (via rowOrderWillDropTree), but the
// warning dialog surfaces that destruction to the user first.
export default observer(function WiggleSetColorDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<Source> & {
    isFaceted: boolean
    scoreGradientPaints: boolean
  }
  handleClose: () => void
}) {
  const { isFaceted } = model
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title="Wiggle color/arrangement editor"
      colorColumns={isFaceted ? [TRACK_COLOR, LABEL_COLOR] : [TRACK_COLOR]}
      defaultColorField={
        isFaceted && model.scoreGradientPaints ? 'labelColor' : 'color'
      }
      reservedFields={isFaceted ? undefined : OVERLAY_RESERVED}
      enableBulkEdit
      enableRowPalettizer
    />
  )
})
