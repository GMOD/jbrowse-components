import RowArrangementDialog from '@jbrowse/tree-sidebar/RowArrangementDialog'
import { observer } from 'mobx-react'

import { plotColorOf } from '../plotColorLine.ts'

import type { ResolvedWiggleColor } from '../../shared/wiggleColor.ts'
import type { Source } from '../../util.ts'
import type { Plot } from '@jbrowse/core/configuration'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { RowArrangementModel } from '@jbrowse/tree-sidebar'

export default observer(function WiggleRowArrangementDialog({
  model,
  handleClose,
}: {
  model: RowArrangementModel<Source> & {
    wiggleColor: ResolvedWiggleColor
    markSources: readonly { color?: string }[]
    colorSetting: ColorSetting
    isDensityMode: boolean
    discoveredRows: readonly unknown[]
    applyPlot: (draft: Plot) => void
    openPlotDialog: () => void
    parkedColor?: ColorSlots
    parkColor: (name: string, written: ColorSlots, next: unknown) => void
  }
  handleClose: () => void
}) {
  // One subtrack has nothing to arrange, so the dialog is the plot's colors
  // and the buttons — which is the whole color UI a plain BigWig needs.
  const showRows = model.discoveredRows.length > 1
  const { line, edit, parkable } = plotColorOf(model)
  return (
    <RowArrangementDialog
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
              cut: line.cut,
              mode: line.mode,
              reason: line.reason,
              onSubmit: next => {
                const color = edit(next)
                model.parkColor('color', parkable, color)
                model.applyPlot({ encoding: { color } })
              },
            }
      }
      onEditAsJson={() => {
        model.openPlotDialog()
      }}
    />
  )
})
