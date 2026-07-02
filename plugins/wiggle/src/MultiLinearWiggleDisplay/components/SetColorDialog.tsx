import { SetColorDialog } from '@jbrowse/tree-sidebar'

import type { Source } from '../../util.ts'
import type { ColorColumn, TreeLayoutModel } from '@jbrowse/tree-sidebar'

// Label color is a power-user concern (the legend already draws label text on a
// white box, so the black default is almost always right); mark it `advanced`
// so the common editor is a single-color grid, and give it a `black`
// defaultColor so its swatch matches what actually renders (OverlayColorLegend
// falls back to black) rather than a misleading placeholder.
const COLOR_COLUMNS: ColorColumn<Source>[] = [
  {
    field: 'color',
    headerName: 'Color',
    bulkLabel: 'Change color of selected',
  },
  {
    field: 'labelColor',
    headerName: 'Label color',
    bulkLabel: 'Change label color of selected',
    advanced: true,
    defaultColor: 'black',
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
