import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const SetFeatureHeightDialog = observer(function (props: {
  model: {
    setFeatureHeight: (arg?: number) => void
    setNoSpacing: (arg?: boolean) => void
    featureHeightSetting: number
    noSpacing?: boolean
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { featureHeightSetting, noSpacing: noSpacingSetting } = model
  const [height, setHeight] = useState(`${featureHeightSetting}`)
  const [noSpacing, setNoSpacing] = useState(noSpacingSetting)

  const ok = height !== '' && !Number.isNaN(+height)

  return (
    <Dialog open onClose={handleClose} title="Set feature height">
      <DialogContent>
        <Typography>
          Adjust the feature height and whether there is any spacing between
          features. Setting feature height to 1 and removing spacing makes the
          display very compact.
        </Typography>
        <TextField
          value={height}
          helperText="Feature height"
          onChange={event => {
            setHeight(event.target.value)
          }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={!!noSpacing}
              onChange={() => {
                setNoSpacing(val => !val)
              }}
            />
          }
          label="Remove spacing between features in y-direction?"
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
              model.setNoSpacing(noSpacing)
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
