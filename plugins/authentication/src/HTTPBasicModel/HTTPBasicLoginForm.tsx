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
      // an incomplete submit used to close as if cancelled, which the account
      // reports as "User cancelled entry" — a failed login the user never made
      submitDisabled={!username || !password}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        handleClose(btoa(`${username}:${password}`))
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
