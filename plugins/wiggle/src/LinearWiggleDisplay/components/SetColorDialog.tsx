import { RestoreDefaultsDialog } from '@jbrowse/core/ui'
import ColorPicker from '@jbrowse/core/ui/ColorPicker'
import { FormControlLabel, Radio, Typography } from '@mui/material'
import { observer } from 'mobx-react'

const SetColorDialog = observer(function SetColorDialog({
  model,
  handleClose,
}: {
  model: {
    color: string
    posColor: string
    negColor: string
    useBicolor: boolean
    setColor: (arg?: string) => void
    setPosColor: (arg?: string) => void
    setNegColor: (arg?: string) => void
    setUseBicolor: (arg?: boolean) => void
  }
  handleClose: () => void
}) {
  return (
    <RestoreDefaultsDialog
      open
      title="Set color"
      onClose={handleClose}
      onRestoreDefault={() => {
        model.setPosColor(undefined)
        model.setNegColor(undefined)
        model.setColor(undefined)
        model.setUseBicolor(undefined)
      }}
    >
      <Typography>
        Select either an overall color, or the positive/negative colors. Note
        that density renderers only work properly with positive/negative colors
      </Typography>
      <FormControlLabel
        checked={!model.useBicolor}
        onClick={() => {
          model.setUseBicolor(false)
        }}
        control={<Radio />}
        label="Overall color"
      />
      <FormControlLabel
        checked={model.useBicolor}
        onClick={() => {
          model.setUseBicolor(true)
        }}
        control={<Radio />}
        label="Positive/negative color"
      />

      {model.useBicolor ? (
        <>
          <Typography>Positive color</Typography>
          <ColorPicker
            color={model.posColor}
            onChange={event => {
              model.setPosColor(event)
            }}
          />
          <Typography>Negative color</Typography>

          <ColorPicker
            color={model.negColor}
            onChange={event => {
              model.setNegColor(event)
            }}
          />
        </>
      ) : (
        <>
          <Typography>Overall color</Typography>
          <ColorPicker
            color={model.color}
            onChange={event => {
              model.setColor(event)
            }}
          />
        </>
      )}
    </RestoreDefaultsDialog>
  )
})

export default SetColorDialog
