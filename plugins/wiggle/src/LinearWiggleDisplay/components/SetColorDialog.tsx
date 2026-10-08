import { SetColorDialog } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { plotColorEdit, plotColorLine } from '../plotColorLine.ts'

import type { ResolvedWiggleColor } from '../../shared/wiggleColor.ts'
import type { Source } from '../../util.ts'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { TreeLayoutModel } from '@jbrowse/tree-sidebar'

export default observer(function WiggleSetColorDialog({
  model,
  handleClose,
}: {
  model: TreeLayoutModel<Source> & {
    wiggleColor: ResolvedWiggleColor
    rowPaletteDeals: boolean
    colorSetting: ColorSetting
    discoveredRows: readonly unknown[]
    setColor: (color?: Partial<ColorSetting> | string) => void
    openPlotDialog: () => void
  }
  handleClose: () => void
}) {
  // One subtrack has nothing to arrange, so the dialog is the plot's colors
  // and the buttons — which is the whole color UI a plain BigWig needs.
  const showRows = model.discoveredRows.length > 1
  const line = plotColorLine(model.wiggleColor, model.rowPaletteDeals)
  return (
    <SetColorDialog
      model={model}
      handleClose={handleClose}
      title={showRows ? 'Wiggle color/arrangement editor' : 'Wiggle color'}
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
        model.openPlotDialog()
      }}
    />
  )
})
