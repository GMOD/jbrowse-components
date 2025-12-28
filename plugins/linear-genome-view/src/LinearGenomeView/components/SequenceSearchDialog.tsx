import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  FormGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  dialogContent: {
    width: '40em',
  },
})

const SequenceSearchDialog = observer(function SequenceSearchDialog({
  model,
  handleClose,
}: {
  model: {
    assemblyNames: string[]
    showTrack: (trackId: string) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [value, setValue] = useState('')
  const [searchForward, setSearchForward] = useState(true)
  const [searchReverse, setSearchReverse] = useState(true)
  const [caseInsensitive, setCaseInsensitive] = useState(true)

  let error: unknown

  try {
    new RegExp(value)
  } catch (e) {
    error = e
  }

  function onSubmit() {
    if (value) {
      const trackId = `sequence_search_${Date.now()}`
      const session = getSession(model)
      const { assemblyManager } = session
      const assemblyName = model.assemblyNames[0]!
      if (isSessionWithAddTracks(session)) {
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
            caseInsensitive,
            sequenceAdapter: getSnapshot(
              assemblyManager.get(assemblyName)?.configuration.sequence.adapter,
            ),
          },
        })
        model.showTrack(trackId)
      }
    }
    handleClose()
  }

  return (
    <Dialog maxWidth="xl" open onClose={handleClose} title="Sequence search">
      <form
        onSubmit={event => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <DialogContent className={classes.dialogContent}>
          <Typography>
            Supply a sequence to search for. A track will be created with the
            resulting matches once submitted. You can also supply regex style
            expressions e.g. AACT(C|T).
          </Typography>
          <TextField
            value={value}
            autoFocus
            onChange={e => {
              setValue(e.target.value)
            }}
            helperText="Sequence search pattern"
          />
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={searchForward}
                  onChange={event => {
                    setSearchForward(event.target.checked)
                  }}
                />
              }
              label="Search forward strand"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={searchReverse}
                  onChange={event => {
                    setSearchReverse(event.target.checked)
                  }}
                />
              }
              label="Search reverse strand"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={caseInsensitive}
                  onChange={event => {
                    setCaseInsensitive(event.target.checked)
                  }}
                />
              }
              label="Case insensitive"
            />
          </FormGroup>
          {error ? <Typography color="error">{`${error}`}</Typography> : null}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="primary" type="submit">
            Submit
          </Button>
          <Button
            onClick={() => {
              handleClose()
            }}
            variant="contained"
            color="secondary"
          >
            Close
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
})

export default SequenceSearchDialog
