import React, { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@jbrowse/core/ui/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'

export const HTTPBasicLoginForm = ({
  internetAccountId,
  handleClose,
}: {
  internetAccountId: string
  handleClose: (arg?: string) => void
}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (username && password) {
      handleClose(btoa(`${username}:${password}`))
    } else {
      handleClose()
    }
    event.preventDefault()
  }

  return (
    <>
      <Dialog
        open
        maxWidth="xl"
        data-testid="login-httpbasic"
        title={`Log In for ${internetAccountId}`}
      >
        <form onSubmit={onSubmit}>
          <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
            <TextField
              required
              label="Username"
              variant="outlined"
              inputProps={{ 'data-testid': 'login-httpbasic-username' }}
              onChange={event => setUsername(event.target.value)}
              margin="dense"
            />
            <TextField
              required
              label="Password"
              type="password"
              autoComplete="current-password"
              variant="outlined"
              inputProps={{ 'data-testid': 'login-httpbasic-password' }}
              onChange={event => setPassword(event.target.value)}
              margin="dense"
            />
          </DialogContent>
          <DialogActions>
            <Button variant="contained" color="primary" type="submit">
              Submit
            </Button>
            <Button
              variant="contained"
              type="submit"
              onClick={() => handleClose()}
            >
              Cancel
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  )
}
