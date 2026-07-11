import { useState } from 'react'

import { ConfirmDialog, ErrorMessage } from '@jbrowse/core/ui'
import { DialogContentText, TextField } from '@mui/material'

import type { LaunchCallback } from '../types.ts'

export default function OpenConfigUrlDialog({
  launch,
  onClose,
}: {
  launch: LaunchCallback
  onClose: () => void
}) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<unknown>()

  function onSubmit() {
    try {
      const trimmed = url.trim()
      if (!trimmed) {
        throw new Error('Please enter a config.json URL')
      }
      // parse to validate, and to default the label to the host if unnamed
      const shortName = name.trim() || new URL(trimmed).hostname
      launch([{ shortName, jbrowseConfig: trimmed }])
      onClose()
    } catch (e) {
      setError(e)
    }
  }

  return (
    <ConfirmDialog
      open
      title="Open config from URL"
      onSubmit={() => {
        onSubmit()
      }}
      onCancel={() => {
        onClose()
      }}
    >
      <DialogContentText>
        Enter the URL of a JBrowse <code>config.json</code>. Relative track URIs
        resolve against the config&apos;s own location, so a hosted config opens
        the same way it does on the web.
      </DialogContentText>
      <TextField
        autoFocus
        fullWidth
        margin="dense"
        label="config.json URL"
        placeholder="https://example.com/jbrowse/config.json"
        value={url}
        onChange={event => {
          setUrl(event.target.value)
        }}
      />
      <TextField
        fullWidth
        margin="dense"
        label="Name (optional)"
        value={name}
        onChange={event => {
          setName(event.target.value)
        }}
      />
      {error ? <ErrorMessage error={error} /> : null}
    </ConfirmDialog>
  )
}
