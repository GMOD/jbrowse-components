import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  root: {
    width: 500,
  },
})

const SetHeightDialog = observer(function (props: {
  model: {
    rowHeight?: number
    setRowHeight: (arg: number) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { classes } = useStyles()
  const [height, setHeight] = useState(`${model.rowHeight}`)

  return (
    <Dialog open onClose={handleClose} title="Set height of dialog">
      <DialogContent className={classes.root}>
        <Typography>
          Set height of characters in the linear reference sequence
        </Typography>
        <TextField
          value={height}
          autoFocus
          onChange={event => setHeight(event.target.value)}
          placeholder="Enter height for sequence track layout"
        />
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            onClick={() => {
              if (height !== '' && !Number.isNaN(+height)) {
                model.setRowHeight(+height)
              }
              handleClose()
            }}
          >
            Submit
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => handleClose()}
          >
            Cancel
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
})
export default SetHeightDialog
