import React, { useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import {
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

// icons
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import CloseIcon from '@mui/icons-material/Close'

// locals
import { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
}))

function SequenceDialog({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [value, setValue] = useState('')

  return (
    <Dialog maxWidth="xl" open onClose={handleClose}>
      <DialogTitle>
        Sequence search
        {handleClose ? (
          <IconButton
            className={classes.closeButton}
            onClick={() => {
              handleClose()
            }}
            size="large"
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
      <Divider />

      <DialogContent>
        <Typography>Set a sequence search pattern</Typography>
        <TextField value={value} onChange={e => setValue(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {}}
          color="primary"
          startIcon={<ContentCopyIcon />}
        >
          Submit
        </Button>

        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(SequenceDialog)
