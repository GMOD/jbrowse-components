import { SubmitDialog } from '@jbrowse/core/ui'
import ColorPicker from '@jbrowse/core/ui/ColorPicker'
import { FormControlLabel, Radio, TextField, Typography } from '@mui/material'
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
    bicolorPivot: number
    setColor: (arg?: string) => void
    setPosColor: (arg?: string) => void
    setNegColor: (arg?: string) => void
    setUseBicolor: (arg?: boolean) => void
    setBicolorPivot: (arg?: number) => void
  }
  handleClose: () => void
}) {
  return (
    <SubmitDialog
      open
      title="Set color"
      submitText="Close"
      onCancel={handleClose}
      onSubmit={handleClose}
      onReset={() => {
        model.setPosColor(undefined)
        model.setNegColor(undefined)
        model.setColor(undefined)
        model.setUseBicolor(undefined)
        model.setBicolorPivot(undefined)
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
          <Typography>
            Pivot value (scores above use the positive color and grow upward,
            scores below use the negative color and grow downward)
          </Typography>
          <TextField
            type="number"
            value={model.bicolorPivot}
            onChange={event => {
              const val = event.target.value
              model.setBicolorPivot(val === '' ? undefined : Number(val))
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
    </SubmitDialog>
  )
})

export default SetColorDialog
