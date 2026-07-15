import { Dialog } from '@jbrowse/core/ui'
import { DialogContent, DialogContentText } from '@mui/material'

export default function ExportToWebInfoDialog({
  onClose,
  open,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      title="About exporting to the web"
      onClose={() => {
        onClose()
      }}
    >
      <DialogContent>
        <DialogContentText>
          This opens your desktop session in jbrowse-web. Tracks pointing at
          remote URLs load directly; local files are not accessible from the web
          and will not load.
        </DialogContentText>
        <DialogContentText>
          <strong>Short link</strong> (recommended): the session is encrypted in
          your browser with a random password, then uploaded to a central
          database. The password lives only in the link, never on the server, so
          short links are effectively end-to-end encrypted.
        </DialogContentText>
        <DialogContentText>
          <strong>Long link</strong>: the full session is compressed into the
          URL itself. Nothing is uploaded, but the URL can get long enough to
          break some programs.
        </DialogContentText>
        <DialogContentText>
          <strong>Plaintext JSON</strong>: the readable session embedded in the
          URL, uncompressed. Longest of the three, but lets you inspect exactly
          what will be opened on the web.
        </DialogContentText>
      </DialogContent>
    </Dialog>
  )
}
