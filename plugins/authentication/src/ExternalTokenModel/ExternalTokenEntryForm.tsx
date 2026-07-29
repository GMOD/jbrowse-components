import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { TextField } from '@mui/material'

export const ExternalTokenEntryForm = ({
  internetAccountId,
  handleClose,
}: {
  internetAccountId: string
  handleClose: (token?: string) => void
}) => {
  const [token, setToken] = useState('')

  return (
    <SubmitDialog
      open
      maxWidth="xl"
      data-testid="externalToken-form"
      title={`Enter token for ${internetAccountId}`}
      submitText="Add"
      submitDisabled={!token}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        handleClose(token)
      }}
    >
      <TextField
        required
        label="Enter Token"
        variant="outlined"
        onChange={event => {
          setToken(event.target.value)
        }}
        margin="dense"
        slotProps={{
          htmlInput: { 'data-testid': 'entry-externalToken' },
        }}
      />
    </SubmitDialog>
  )
}
