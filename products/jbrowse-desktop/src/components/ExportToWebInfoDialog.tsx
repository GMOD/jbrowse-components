import { InfoDialog } from '@jbrowse/core/ui'
import { DialogContentText } from '@mui/material'

export default function ExportToWebInfoDialog({
  onClose,
  open,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <InfoDialog
      open={open}
      title="About exporting to the web"
      onClose={() => {
        onClose()
      }}
    >
      <DialogContentText>
        This opens your desktop session in jbrowse-web. Tracks pointing at
        remote URLs load directly. Files on this computer are not reachable from
        the web, so tracks that use one are left out of the export and listed
        for you; host those files at a URL to include them. A text-search index
        built on this computer is the exception: the track still travels, and
        only its search box stays behind.
      </DialogContentText>
      <DialogContentText>
        <strong>Long link</strong> (the default): the full session is compressed
        into the URL itself. Nothing leaves this computer, but the URL can get
        long enough to break some programs.
      </DialogContentText>
      <DialogContentText>
        <strong>Short link</strong>: the session is encrypted in your browser
        with a random password, then uploaded to a central database. The
        password lives only in the link, never on the server, so short links are
        effectively end-to-end encrypted — but the session does leave this
        computer, which is why nothing is uploaded until you ask for it.
      </DialogContentText>
      <DialogContentText>
        <strong>Plaintext JSON</strong>: the readable session embedded in the
        URL, uncompressed. Longest of the three, but lets you inspect exactly
        what will be opened on the web.
      </DialogContentText>
    </InfoDialog>
  )
}
