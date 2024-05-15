import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  Typography,
  TextField,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  root: {
    width: 500,
  },
})

const AddFiltersDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    maxHeight?: number
    setMaxHeight: (arg?: number) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { jexlFilters = [] } = model

  return (
    <Dialog open onClose={handleClose} title="Set max height">
      <DialogContent className={classes.root}>
        {jexlFilters.map(f => (
          <TextField
            value={f}
            onChange={event => {
              model.setFilters(f)
            }}
          ></TextField>
        ))}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          autoFocus
          onClick={() => {
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
    </Dialog>
  )
})

export default AddFiltersDialog
