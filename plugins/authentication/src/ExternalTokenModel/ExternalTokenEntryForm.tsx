import React, { useState } from 'react'
import { Button, DialogContent, DialogActions, TextField } from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'

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
      <Dialog
        open
        maxWidth="xl"
        data-testid="externalToken-form"
        title={`Enter token for ${internetAccountId}`}
      >
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            required
            label="Enter Token"
            variant="outlined"
            inputProps={{ 'data-testid': 'entry-externalToken' }}
            onChange={event => setToken(event.target.value)}
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
            onClick={() => handleClose()}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
