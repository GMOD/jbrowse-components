import { InfoDialog, MonospaceTextField } from '@jbrowse/core/ui'
import { copyTextWithSession } from '@jbrowse/core/util/copyText'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { AbstractSessionModel } from '@jbrowse/core/util'

const SessionJsonDialog = observer(function SessionJsonDialog({
  session,
  snap,
  onClose,
}: {
  session: Pick<AbstractSessionModel, 'notify' | 'notifyError'>
  snap: unknown
  onClose: () => void
}) {
  const json = JSON.stringify(snap, null, 2)
  return (
    <InfoDialog
      open
      maxWidth="md"
      fullWidth
      title="Session JSON"
      onClose={onClose}
      actions={
        <Button
          startIcon={<ContentCopyIcon />}
          onClick={() => {
            void copyTextWithSession(session, json, 'session JSON')
          }}
        >
          Copy to Clipboard
        </Button>
      }
    >
      <MonospaceTextField
        label="Session JSON"
        value={json}
        readOnly
        fullWidth
        maxRows={20}
      />
    </InfoDialog>
  )
})

export default SessionJsonDialog
