import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'

const ConfirmDialog = ({
  tracks,
  onClose,
}: {
  tracks: AnyConfigurationModel[]
  onClose: (arg: boolean, arg1?: { name: string }) => void
}) => {
  const [val, setVal] = useState('MultiWiggle ' + Date.now())
  const allQuant = tracks.every(t => t.type === 'QuantitativeTrack')
  return (
    <Dialog open onClose={() => onClose(false)}>
      <DialogTitle>Confirm multi-wiggle track create</DialogTitle>
      <DialogContent>
        <Typography>
          {!allQuant
            ? 'Not every track looks like a QuantitativeTrack. This could have unexpected behavior, confirm if it looks ok.'
            : null}
          Listing:
        </Typography>
        <ul>
          {tracks.map(track => (
            <li key={track.trackId}>
              {readConfObject(track, 'name')} - {track.type}
            </li>
          ))}
        </ul>
        <TextField
          value={val}
          onChange={event => setVal(event.target.value)}
          helperText="Track name"
        />
        <Typography>Confirm creation of track?</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} color="primary">
          Cancel
        </Button>
        <Button
          onClick={() => onClose(true, { name: val })}
          color="primary"
          variant="contained"
          autoFocus
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmDialog
