import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  TextField,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
// locals
import { navToSynteny } from './util'
import type { Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  padding: {
    margin: 10,
    border: '1px solid #ccc',
  },
})

export default function LaunchSyntenyViewDialog({
  model,
  feature,
  trackId,
  handleClose,
}: {
  model: unknown
  feature: Feature
  trackId: string
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const inverted = feature.get('strand') === -1
  const [horizontallyFlip, setHorizontallyFlip] = useState(inverted)
  const [windowSize, setWindowSize] = useState('1000')
  return (
    <Dialog open title="Launch synteny view" onClose={handleClose}>
      <DialogContent>
        {inverted ? (
          <FormControlLabel
            className={classes.padding}
            control={
              <Checkbox
                checked={horizontallyFlip}
                onChange={event => {
                  setHorizontallyFlip(event.target.checked)
                }}
              />
            }
            label="Note: The feature is inverted in orientation on the target
            sequence. This will result in the lower panel having genomic
            coordinates decreasing left to right. Horizontally flip?"
          />
        ) : null}
        <TextField
          label="Add window size in bp"
          value={windowSize}
          onChange={event => {
            setWindowSize(event.target.value)
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                await navToSynteny({
                  feature,
                  windowSize: +windowSize,
                  horizontallyFlip,
                  trackId,
                  model,
                })
              } catch (e) {
                console.error(e)
                getSession(model).notifyError(`${e}`, e)
              }
            })()
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
    </Dialog>
  )
}
