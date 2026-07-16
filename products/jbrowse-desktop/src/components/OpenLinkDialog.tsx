import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import ConfirmDialog from '@jbrowse/core/ui/ConfirmDialog'
import { DialogContentText, TextField } from '@mui/material'

import { useIpcAction } from './StartScreen/dialogs/useIpcAction.ts'

// Opens a JBrowse Web link (a jbrowse.org figure/share link with a
// `&session=spec-…`) as a Desktop session: the URL names a config and a session
// spec, both of which Desktop can load itself. Anything else — an unreachable
// config, a session kind only the originating instance can decrypt — surfaces
// as the dialog's own error rather than a half-built session.
export default function OpenLinkDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (link: string) => Promise<void>
  onClose: () => void
}) {
  const [link, setLink] = useState('')
  const {
    error,
    pending,
    onSubmit: submit,
  } = useIpcAction(async () => {
    if (!link.trim()) {
      throw new Error('Please paste a JBrowse Web link')
    }
    await onSubmit(link)
  }, onClose)
  return (
    <ConfirmDialog
      open
      maxWidth="sm"
      fullWidth
      title="Open JBrowse Web link"
      submitText={pending ? 'Opening...' : 'OK'}
      submitDisabled={pending}
      onSubmit={submit}
      onCancel={onClose}
    >
      <DialogContentText>
        Paste a JBrowse Web link — for example the "Open this view in JBrowse"
        link under a figure in the documentation. Its genome, tracks, and
        location open here as a new session.
      </DialogContentText>
      <TextField
        autoFocus
        fullWidth
        multiline
        maxRows={4}
        variant="outlined"
        margin="dense"
        placeholder="https://jbrowse.org/code/jb2/latest/?config=…&session=spec-…"
        value={link}
        onChange={event => {
          setLink(event.target.value)
        }}
      />
      {error ? <ErrorMessage error={error} /> : null}
    </ConfirmDialog>
  )
}
