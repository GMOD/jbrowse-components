import React from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'

const ConfirmDialog = ({
  tracks,
  onClose,
}: {
  tracks: { trackId: string; type: string }[]
  onClose: (arg: boolean) => void
}) => {
  return (
    <Dialog open onClose={() => onClose(false)}>
      <DialogTitle>Confirm multi-wiggle track create</DialogTitle>
      <DialogContent>
        <Typography>
          Not every track composing this multi-wiggle track is a
          QuantitativeTrack. Listing:
        </Typography>
        <ul>
          {tracks.map(track => (
            <li key={track.trackId}>
              {track.trackId} - {track.type}
            </li>
          ))}
        </ul>
        <Typography>Confirm creation of track?</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} color="primary">
          Cancel
        </Button>
        <Button
          onClick={() => onClose(true)}
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
