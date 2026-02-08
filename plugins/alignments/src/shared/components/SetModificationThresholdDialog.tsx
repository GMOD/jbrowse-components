import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { ColorBy } from '../types.ts'

const SetModificationThresholdDialog = observer(
  function SetModificationThresholdDialog(props: {
    model: {
      modificationThreshold: number
      colorBy?: ColorBy
      setColorScheme: (colorBy: ColorBy) => void
    }
    handleClose: () => void
  }) {
    const { model, handleClose } = props
    const [threshold, setThreshold] = useState(
      String(model.modificationThreshold),
    )
    const numThreshold = Number.parseFloat(threshold)
    const validThreshold =
      !Number.isNaN(numThreshold) && numThreshold >= 0 && numThreshold <= 100

    return (
      <Dialog open onClose={handleClose} title="Adjust modification threshold">
        <DialogContent>
          <Typography>
            Set the minimum probability threshold for displaying modifications
          </Typography>
          <Typography color="textSecondary">
            Only modifications with probability above this threshold will be
            displayed (0-100%)
          </Typography>
          <TextField
            value={threshold}
            onChange={event => {
              setThreshold(event.target.value)
            }}
            placeholder="Enter threshold (e.g., 10)"
            error={threshold !== '' && !validThreshold}
            helperText={
              threshold !== '' && !validThreshold
                ? 'Must be a number between 0 and 100'
                : ''
            }
            autoComplete="off"
            type="number"
            slotProps={{
              htmlInput: {
                min: 0,
                max: 100,
                step: 1,
              },
            }}
          />
          <DialogActions>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              autoFocus
              disabled={!validThreshold}
              onClick={() => {
                const currentColorBy = model.colorBy || {
                  type: 'modifications',
                }
                model.setColorScheme({
                  ...currentColorBy,
                  modifications: {
                    ...currentColorBy.modifications,
                    threshold: numThreshold,
                  },
                })
                handleClose()
              }}
            >
              Submit
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                handleClose()
              }}
            >
              Cancel
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    )
  },
)

export default SetModificationThresholdDialog
