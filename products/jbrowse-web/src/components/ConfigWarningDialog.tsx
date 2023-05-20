import React from 'react'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import shortid from 'shortid'
import factoryReset from '../factoryReset'
import { SessionLoaderModel } from '../SessionLoader'

import WarningIcon from '@mui/icons-material/Warning'

function ConfigWarningDialog({
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
      aria-labelledby="alert-dialog-title"
    >
      <DialogContent>
        <WarningIcon fontSize="large" />
        <DialogContentText>
          This link contains a cross origin config that has the following
          unknown plugins:
          <ul>
            {reason.map(r => (
              <li key={JSON.stringify(r)}>URL: {r.url}</li>
            ))}
          </ul>
          Please ensure you trust the source of this link.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="primary" variant="contained" onClick={() => onConfirm()}>
          Yes, I trust it
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => onCancel()}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function ConfigTriaged({
  loader,
  handleClose,
}: {
  loader: SessionLoaderModel
  handleClose: () => void
}) {
  return (
    <ConfigWarningDialog
      onConfirm={async () => {
        const session = JSON.parse(JSON.stringify(loader.sessionTriaged.snap))
        await loader.fetchPlugins(session)
        loader.setConfigSnapshot({ ...session, id: shortid() })
        handleClose()
      }}
      onCancel={async () => {
        await factoryReset()
        handleClose()
      }}
      reason={loader.sessionTriaged.reason}
    />
  )
}
