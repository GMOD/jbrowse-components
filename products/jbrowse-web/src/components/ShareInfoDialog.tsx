import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { DialogContent, DialogContentText } from '@mui/material'

export default function InfoDialog({
  onClose,
  open,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog
      onClose={() => {
        onClose()
      }}
      open={open}
      title="Info about session URLs"
    >
      <DialogContent>
        <DialogContentText>
          Because everything about the JBrowse session is encoded in the URL
          (e.g. state of the tracks, views, features selected, etc.) the
          sessions can get very long. Therefore, we created a URL shortener,
          both as a convenience and because long URLs can break some programs.
          Note that both the long and short URLs encode the same data, but due
          to long URLs causing problems with some programs, we recommend sharing
          short URLs.
        </DialogContentText>
        <DialogContentText>
          We generate the short URLs in a secure manner which involves
          encrypting the session on the client side with a random password
          string and uploading them to a central database. Then the random
          password is added to the URL but is not uploaded to the central
          database, making these short URLs effectively &quot;end-to-end
          encrypted&quot;
        </DialogContentText>
        <DialogContentText>
          Only users with a share link can read the session.
        </DialogContentText>
      </DialogContent>
    </Dialog>
  )
}
