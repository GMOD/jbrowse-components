import { SubmitDialog } from '@jbrowse/core/ui'
import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Alert,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  fields: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 24,
    marginTop: 12,
  },
  field: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  pivot: {
    width: 200,
  },
})

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
    isDensityMode: boolean
    setColor: (arg?: string) => void
    setPosColor: (arg?: string) => void
    setNegColor: (arg?: string) => void
    setUseBicolor: (arg?: boolean) => void
    setBicolorPivot: (arg?: number) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  return (
    <SubmitDialog
      open
      title="Set color"
      submitText="Close"
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        handleClose()
      }}
      onReset={() => {
        model.setPosColor(undefined)
        model.setNegColor(undefined)
        model.setColor(undefined)
        model.setUseBicolor(undefined)
        model.setBicolorPivot(undefined)
      }}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={model.useBicolor ? 'bicolor' : 'single'}
        onChange={(_event, value) => {
          if (value) {
            model.setUseBicolor(value === 'bicolor')
          }
        }}
      >
        <ToggleButton value="single">Single color</ToggleButton>
        <ToggleButton value="bicolor">Positive/negative</ToggleButton>
      </ToggleButtonGroup>

      {model.isDensityMode && !model.useBicolor ? (
        <Alert severity="info">
          Density rendering maps scores onto the positive/negative colors, so a
          single color has no effect
        </Alert>
      ) : null}

      {model.useBicolor ? (
        <div className={classes.fields}>
          <div className={classes.field}>
            <div data-testid="wiggle-pos-color">
              <PopoverPicker
                color={model.posColor}
                onChange={color => {
                  model.setPosColor(color)
                }}
              />
            </div>
            <Typography>Positive</Typography>
          </div>
          <div className={classes.field}>
            <div data-testid="wiggle-neg-color">
              <PopoverPicker
                color={model.negColor}
                onChange={color => {
                  model.setNegColor(color)
                }}
              />
            </div>
            <Typography>Negative</Typography>
          </div>
          <TextField
            className={classes.pivot}
            label="Pivot"
            type="number"
            size="small"
            helperText="Scores above the pivot grow upward, below grow downward"
            value={model.bicolorPivot}
            onChange={event => {
              const val = event.target.value
              model.setBicolorPivot(val === '' ? undefined : Number(val))
            }}
          />
        </div>
      ) : (
        <div className={classes.fields}>
          <div className={classes.field}>
            <div data-testid="wiggle-overall-color">
              <PopoverPicker
                color={model.color}
                onChange={color => {
                  model.setColor(color)
                }}
              />
            </div>
            <Typography>Overall color</Typography>
          </div>
        </div>
      )}
    </SubmitDialog>
  )
})

export default SetColorDialog
