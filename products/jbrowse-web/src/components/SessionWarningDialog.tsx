import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material'
import shortid from 'shortid'
import { SessionLoaderModel } from '../SessionLoader'

import WarningIcon from '@mui/icons-material/Warning'

function SessionWarningDialog({
  onConfirm,
  onCancel,
  reason,
}: {
  onConfirm: () => void
  onCancel: () => void
  reason: { url: string }[]
}) {
  return (
    <Dialog
      open
      maxWidth="xl"
      data-testid="session-warning-modal"
      title="Warning"
    >
      <DialogContent>
        <WarningIcon fontSize="large" />
        <DialogContentText>
          This link contains a session that has the following unknown plugins:
          <ul>
            {reason.map(r => (
              <li key={JSON.stringify(r)}>URL: {r.url}</li>
            ))}
          </ul>
          Please ensure you trust the source of this session.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="primary" variant="contained" onClick={() => onConfirm()}>
          Yes, I trust it
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => onCancel()}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function SessionTriaged({
  loader,
  handleClose,
}: {
  loader: SessionLoaderModel
  handleClose: () => void
}) {
  return (
    <SessionWarningDialog
      onConfirm={async () => {
        const session = JSON.parse(JSON.stringify(loader.sessionTriaged.snap))

        // second param true says we passed user confirmation
        await loader.setSessionSnapshot({ ...session, id: shortid() }, true)
        handleClose()
      }}
      onCancel={() => {
        loader.setBlankSession(true)
        handleClose()
      }}
      reason={loader.sessionTriaged.reason}
    />
  )
}
