import { SetColorDialog } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import ScoreSignColors from './ScoreSignColors.tsx'

import type { Source } from '../../util.ts'
import type { ColorColumn, TreeLayoutModel } from '@jbrowse/tree-sidebar'

const TRACK_COLOR: ColorColumn<Source> = {
  field: 'color',
  headerName: 'Track color',
  bulkLabel: 'Change track color of selected',
}

// Row-label sidebar tint, and in density the channel a row's identity color
// lives in — which is why it is the default column there. See the color-model
// table in sourcesLogic.ts; this dialog does not re-decide any of it.
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
    posColor: string
    negColor: string
    setPosColor: (arg?: string) => void
    setNegColor: (arg?: string) => void
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
      // overlay paints a source's negative features in its own (positive)
      // color, so only a multirow mode has two sides to color
      displayControls={multirow ? <ScoreSignColors model={model} /> : null}
      enableBulkEdit
      enableRowPalettizer
    />
  )
})
