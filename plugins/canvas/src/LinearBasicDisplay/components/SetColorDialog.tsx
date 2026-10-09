import ColorPicker from '@jbrowse/core/ui/ColorPicker'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

// The UTR picker shows only on a display that has a `utrColor` slot.
const SetColorDialog = observer(function SetColorDialog({
  model,
  handleClose,
}: {
  model: {
    featureColor: string
    colorSetting: { value?: string }
    setColorValue: (value: string | undefined) => void
    utrColor?: string
    setUtrColor?: (arg?: string) => void
  }
  handleClose: () => void
}) {
  const { utrColor, setUtrColor } = model
  return (
    <SolidColorDialog
      label="Feature color"
      color={model.featureColor}
      written={model.colorSetting.value}
      onChange={color => {
        model.setColorValue(color)
      }}
      onReset={() => {
        model.setColorValue(undefined)
        setUtrColor?.(undefined)
      }}
      handleClose={handleClose}
    >
      {utrColor !== undefined && setUtrColor ? (
        <>
          <Typography>UTR color (gene/transcript UTRs)</Typography>
          <ColorPicker
            color={utrColor}
            onChange={color => {
              setUtrColor(color)
            }}
          />
        </>
      ) : null}
    </SolidColorDialog>
  )
})

export default SetColorDialog
