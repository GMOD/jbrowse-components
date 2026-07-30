import { InfoDialog } from '@jbrowse/core/ui'
import { DialogContentText } from '@mui/material'

export default function ShareInfoDialog({
  onClose,
  open,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <InfoDialog
      open={open}
      title="Info about session URLs"
      onClose={() => {
        onClose()
      }}
    >
      <DialogContentText>
        A session encodes your tracks, views, and selections in the URL, so it
        can get long. All three formats below carry the same data.
      </DialogContentText>
      <DialogContentText>
        <strong>Short URL</strong> (recommended): the session is encrypted in
        your browser with a random password, then uploaded to a central
        database. The password lives only in the URL, never on the server, so
        short URLs are effectively end-to-end encrypted — only someone with the
        link can read the session.
      </DialogContentText>
      <DialogContentText>
        <strong>Long URL</strong>: the full session is compressed into the URL
        itself. Nothing is uploaded, but the URL can get long enough to break
        some programs.
      </DialogContentText>
      <DialogContentText>
        <strong>Plaintext JSON</strong>: the readable session embedded in the
        URL, uncompressed. Longest of the three, but lets you inspect exactly
        what the session contains.
      </DialogContentText>
    </InfoDialog>
  )
}
