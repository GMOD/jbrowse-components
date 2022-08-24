import React, { useState } from 'react'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormGroup,
  FormControlLabel,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import { getSnapshot } from 'mobx-state-tree'
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
    width: '40em',
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
  const [searchForward, setSearchForward] = useState(true)
  const [searchReverse, setSearchReverse] = useState(true)

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

      <DialogContent className={classes.dialogContent}>
        <Typography>
          Supply a sequence to search for. A track will be created with the
          resulting matches once submitted. You can also supply regex style
          expressions.
        </Typography>
        <TextField
          value={value}
          onChange={e => setValue(e.target.value)}
          helperText="Sequence search pattern"
        />
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={searchForward}
                onChange={event => setSearchForward(event.target.checked)}
              />
            }
            label="Search forward strand"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={searchReverse}
                onChange={event => setSearchReverse(event.target.checked)}
              />
            }
            label="Search reverse strand"
          />
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            if (value) {
              const trackId = `sequence_search_${+Date.now()}`
              const session = getSession(model)
              const { assemblyManager } = session
              const assemblyName = model.assemblyNames[0]
              session.addTrackConf({
                trackId,
                name: `Sequence search ${value}`,
                assemblyNames: [assemblyName],
                type: 'FeatureTrack',
                adapter: {
                  type: 'SequenceSearchAdapter',
                  search: value,
                  searchForward,
                  searchReverse,
                  sequenceAdapter: getSnapshot(
                    assemblyManager.get(assemblyName)?.configuration.sequence
                      .adapter,
                  ),
                },
              })
              model.toggleTrack(trackId)
            }
            handleClose()
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
