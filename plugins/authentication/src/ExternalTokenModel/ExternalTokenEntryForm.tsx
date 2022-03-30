import React, { useState } from 'react'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogActions from '@material-ui/core/DialogActions'
import TextField from '@material-ui/core/TextField'

export const ExternalTokenEntryForm = ({
  internetAccountId,
  handleClose,
}: {
  internetAccountId: string
  handleClose: (token?: string) => void
}) => {
  const [token, setToken] = useState('')

  return (
    <>
      <Dialog open maxWidth="xl" data-testid="externalToken-form">
        <DialogTitle>Enter Token for {internetAccountId}</DialogTitle>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            required
            label="Enter Token"
            variant="outlined"
            inputProps={{ 'data-testid': 'entry-externalToken' }}
            onChange={event => {
              setToken(event.target.value)
            }}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={!token}
            onClick={() => {
              if (token) {
                handleClose(token)
              }
            }}
          >
            Add
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
