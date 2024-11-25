import React from 'react'
import { pluginDescriptionString } from '@jbrowse/core/PluginLoader'
import { Dialog } from '@jbrowse/core/ui'
import { nanoid } from '@jbrowse/core/util/nanoid'
import WarningIcon from '@mui/icons-material/Warning'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import factoryReset from '../factoryReset'
import type { SessionLoaderModel } from '../SessionLoader'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

function ConfigWarningDialog({
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
          This link contains a cross origin config that has the following
          unknown plugins:
          <ul>
            {reason.map(r => (
              <li key={JSON.stringify(r)}>{pluginDescriptionString(r)}</li>
            ))}
          </ul>
          Please ensure you trust the source of this link.
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
          color="secondary"
          variant="contained"
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

export default function ConfigTriaged({
  loader,
  handleClose,
}: {
  loader: SessionLoaderModel
  handleClose: () => void
}) {
  const { sessionTriaged } = loader
  return sessionTriaged ? (
    <ConfigWarningDialog
      onConfirm={async () => {
        const session = JSON.parse(JSON.stringify(sessionTriaged.snap))
        await loader.fetchPlugins(session)
        loader.setConfigSnapshot({ ...session, id: nanoid() })
        handleClose()
      }}
      onCancel={async () => {
        await factoryReset()
        handleClose()
      }}
      reason={sessionTriaged.reason}
    />
  ) : null
}
