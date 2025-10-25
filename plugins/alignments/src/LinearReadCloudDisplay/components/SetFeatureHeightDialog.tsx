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

const SetFeatureHeightDialog = observer(function (props: {
  model: {
    setFeatureHeight: (arg?: number) => void
    featureHeightSetting: number
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { featureHeightSetting } = model
  const [height, setHeight] = useState(`${featureHeightSetting}`)

  const ok = height !== '' && !Number.isNaN(+height)

  return (
    <Dialog open onClose={handleClose} title="Set feature height">
      <DialogContent>
        <Typography>
          Adjust the feature height for reads in the display.
        </Typography>
        <TextField
          value={height}
          helperText="Feature height"
          onChange={event => {
            setHeight(event.target.value)
          }}
        />
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            autoFocus
            disabled={!ok}
            onClick={() => {
              model.setFeatureHeight(
                height !== '' && !Number.isNaN(+height) ? +height : undefined,
              )
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
})

export default SetFeatureHeightDialog
