import React, { useState } from 'react'
import { observer } from 'mobx-react'
import Button from '@mui/material/Button'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import Typography from '@mui/material/Typography'
import Dialog from '@jbrowse/core/ui/Dialog'
import { ColorPicker } from '@jbrowse/core/ui/ColorPicker'

function SetColorDialog({
  model,
  handleClose,
}: {
  model: {
    color?: string
    posColor?: string
    negColor?: string
    setColor: (arg?: string) => void
    setPosColor: (arg?: string) => void
    setNegColor: (arg?: string) => void
  }
  handleClose: () => void
}) {
  const [posneg, setPosNeg] = useState(false)

  return (
    <Dialog open onClose={handleClose} title="Set color">
      <DialogContent>
        <Typography>
          Select either an overall color, or the positive/negative colors. Note
          that density renderers only work properly with positive/negative
          colors
        </Typography>
        <FormControlLabel
          checked={!posneg}
          onClick={() => setPosNeg(false)}
          control={<Radio />}
          label={'Overall color'}
        />
        <FormControlLabel
          checked={posneg}
          onClick={() => setPosNeg(true)}
          control={<Radio />}
          label={'Positive/negative color'}
        />

        {posneg ? (
          <>
            <Typography>Positive color</Typography>
            <ColorPicker
              color={model.posColor || 'black'}
              onChange={event => {
                model.setPosColor(event)
                model.setColor(undefined)
              }}
            />
            <Typography>Negative color</Typography>

            <ColorPicker
              color={model.negColor || 'black'}
              onChange={event => {
                model.setNegColor(event)
                model.setColor(undefined)
              }}
            />
          </>
        ) : (
          <>
            <Typography>Overall color</Typography>
            <ColorPicker
              color={model.color || 'black'}
              onChange={event => model.setColor(event)}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            model.setPosColor(undefined)
            model.setNegColor(undefined)
            model.setColor(undefined)
          }}
          color="secondary"
          variant="contained"
        >
          Restore default
        </Button>

        <Button
          variant="contained"
          color="primary"
          type="submit"
          onClick={() => handleClose()}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(SetColorDialog)
