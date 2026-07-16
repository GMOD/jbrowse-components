import { SetColorDialog } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import type { Source } from '../../util.ts'
import type { ColorColumn, TreeLayoutModel } from '@jbrowse/tree-sidebar'

const TRACK_COLOR: ColorColumn<Source> = {
  field: 'color',
  headerName: 'Track color',
  bulkLabel: 'Change track color of selected',
}

// Row-label sidebar tint. Only meaningful in multirow modes (overlay has no
// sidebar); the headline case is density, where the score→color ramp is the
// data color, so identity coding happens via the label instead.
const LABEL_COLOR: ColorColumn<Source> = {
  field: 'labelColor',
  headerName: 'Label color',
  bulkLabel: 'Change label color of selected',
}

// Overlay mode has no row-label sidebar, so it offers no Label color column —
// but rows still carry `labelColor` (a leftover from multirow, or a
// still-applying value if the user switches back). Reserve it so the grid
// doesn't fall back to rendering it as a raw hex text column.
const OVERLAY_RESERVED: ReadonlySet<string> = new Set(['labelColor'])

// Seed from `editableSources` (not `sources`) so overlay-palette synthesis
// doesn't bake unset colors into the persisted layout on Submit. setLayout
// already clears the cluster tree on reorder (via willClearTree), but the
// warning dialog surfaces that destruction to the user first.
export default observer(function MultiWiggleSetColorDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<Source> & {
    isOverlay: boolean
    isDensityMode: boolean
  }
  handleClose: () => void
}) {
  const multirow = !model.isOverlay
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title="Multi-wiggle color/arrangement editor"
      colorColumns={multirow ? [TRACK_COLOR, LABEL_COLOR] : [TRACK_COLOR]}
      defaultColorField={
        multirow && model.isDensityMode ? 'labelColor' : 'color'
      }
      reservedFields={multirow ? undefined : OVERLAY_RESERVED}
      enableBulkEdit
      enableRowPalettizer
    />
  )
})
