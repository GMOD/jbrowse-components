import React from 'react'
import { pluginDescriptionString } from '@jbrowse/core/PluginLoader'
import { Dialog } from '@jbrowse/core/ui'
import { nanoid } from '@jbrowse/core/util/nanoid'

import WarningIcon from '@mui/icons-material/Warning'
import {
  Button,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material'

import type { SessionLoaderModel } from '../SessionLoader'
import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

function SessionWarningDialog({
  onConfirm,
  onCancel,
  reason,
}: {
  onConfirm: () => void
  onCancel: () => void
  reason: PluginDefinition[]
}) {
  return (
    <Dialog open maxWidth="xl" title="Warning">
      <DialogContent>
        <WarningIcon fontSize="large" />
        <DialogContentText>
          This link contains a session that has the following unknown plugins:
          <ul>
            {reason.map(r => (
              <li key={JSON.stringify(r)}>{pluginDescriptionString(r)}</li>
            ))}
          </ul>
          Please ensure you trust the source of this session.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            onConfirm()
          }}
        >
          Yes, I trust it
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            onCancel()
          }}
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
  const { sessionTriaged } = loader
  return sessionTriaged ? (
    <SessionWarningDialog
      onConfirm={async () => {
        const session = JSON.parse(JSON.stringify(sessionTriaged.snap))

        // second param true says we passed user confirmation
        await loader.setSessionSnapshot({ ...session, id: nanoid() }, true)
        handleClose()
      }}
      onCancel={() => {
        loader.setBlankSession(true)
        handleClose()
      }}
      reason={sessionTriaged.reason}
    />
  ) : null
}
