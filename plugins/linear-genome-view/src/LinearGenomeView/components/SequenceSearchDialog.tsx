import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'

// icons
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
            onClick={() => handleClose()}
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
          onClick={() => {
            const trackId = `sequence_search_${+Date.now()}`
            getSession(model).addTrackConf({
              trackId,
              name: `Sequence search ${value}`,
              assemblyNames: model.assemblyNames,
              type: 'FeatureTrack',
              adapter: {
                type: 'SequenceSearchAdapter',
                subadapter: {},
              },
            })
            model.toggleTrack(trackId)
          }}
          variant="contained"
          color="primary"
        >
          Submit
        </Button>

        <Button
          onClick={() => handleClose()}
          variant="contained"
          color="secondary"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(SequenceDialog)
