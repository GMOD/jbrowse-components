import { SetColorDialog } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { plotColorEdit, plotColorLine } from '../plotColorLine.ts'

import type { ResolvedWiggleColor } from '../../shared/wiggleColor.ts'
import type { Source } from '../../util.ts'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type {
  ColorColumn,
  IdentityChannel,
  TreeLayoutModel,
} from '@jbrowse/tree-sidebar'

// Named for the channel it edits: under a gradient a row's colour is the tint
// beside its label, and the plot's colour is the line above the grid.
const COLUMN: Record<IdentityChannel, ColorColumn<Source>> = {
  color: {
    field: 'color',
    headerName: 'Color',
    bulkLabel: 'Change color of selected',
  },
  labelColor: {
    field: 'labelColor',
    headerName: 'Label color',
    bulkLabel: 'Change label color of selected',
  },
}

// The channel the mode does not edit still rides on the rows, from the adapter
// or from an earlier sitting in the other mode; reserved so the grid neither
// offers it as a raw hex column.
const RESERVED = new Set(['color', 'labelColor'])

export default observer(function WiggleSetColorDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<Source> & {
    identityChannel: IdentityChannel
    wiggleColor: ResolvedWiggleColor
    colorSetting: ColorSetting
    discoveredRows: readonly unknown[]
    setColor: (color?: Partial<ColorSetting> | string) => void
    openChannelSpecDialog: () => void
  }
  handleClose: () => void
}) {
  // One subtrack has nothing to arrange, so the dialog is the plot's colours
  // and the buttons — which is the whole colour UI a plain BigWig needs.
  const showRows = model.discoveredRows.length > 1
  const line = plotColorLine(model.wiggleColor)
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title={showRows ? 'Wiggle color/arrangement editor' : 'Wiggle color'}
      colorColumns={[COLUMN[model.identityChannel]]}
      reservedFields={RESERVED}
      enableBulkEdit
      showRows={showRows}
      plotColor={
        line.mode === 'hide'
          ? undefined
          : {
              above: line.above,
              below: line.below,
              mode: line.mode,
              reason: line.reason,
              onSubmit: next => {
                model.setColor(plotColorEdit(model.colorSetting, next))
              },
            }
      }
      onEditAsJson={() => {
        model.openChannelSpecDialog()
      }}
    />
  )
})
