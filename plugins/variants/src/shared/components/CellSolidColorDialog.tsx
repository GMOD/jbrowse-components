import { isJexl } from '@jbrowse/core/util/jexlStrings'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import { observer } from 'mobx-react'

import { ALT_HUE } from '../cellFill.ts'

import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

const CellSolidColorDialog = observer(function CellSolidColorDialog({
  model,
  handleClose,
}: {
  model: {
    colorSetting: ColorSetting
    setColorValue: (value: string | undefined) => void
  }
  handleClose: () => void
}) {
  const { value } = model.colorSetting
  return (
    <SolidColorDialog
      label="Alt cell color"
      color={value !== undefined && !isJexl(value) ? value : ALT_HUE}
      written={value}
      onChange={color => {
        model.setColorValue(color)
      }}
      onReset={() => {
        model.setColorValue(undefined)
      }}
      handleClose={handleClose}
    />
  )
})

export default CellSolidColorDialog
