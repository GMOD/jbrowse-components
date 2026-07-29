import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { TextField } from '@mui/material'

export function HTTPBasicLoginForm({
  internetAccountId,
  handleClose,
}: {
  internetAccountId: string
  handleClose: (arg?: string) => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <SubmitDialog
      open
      maxWidth="xl"
      data-testid="login-httpbasic"
      title={`Log in for ${internetAccountId}`}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        if (username && password) {
          handleClose(btoa(`${username}:${password}`))
        } else {
          handleClose()
        }
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <TextField
          required
          label="Username"
          variant="outlined"
          onChange={event => {
            setUsername(event.target.value)
          }}
          margin="dense"
          slotProps={{
            htmlInput: { 'data-testid': 'login-httpbasic-username' },
          }}
        />
        <TextField
          required
          label="Password"
          type="password"
          autoComplete="current-password"
          variant="outlined"
          onChange={event => {
            setPassword(event.target.value)
          }}
          margin="dense"
          slotProps={{
            htmlInput: { 'data-testid': 'login-httpbasic-password' },
          }}
        />
      </div>
    </SubmitDialog>
  )
}
