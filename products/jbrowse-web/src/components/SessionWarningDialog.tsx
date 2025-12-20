import { useState } from 'react'

import { pluginDescriptionString, pluginUrl } from '@jbrowse/core/PluginLoader'
import { Dialog } from '@jbrowse/core/ui'
import { Alert, Button, DialogActions, DialogContent } from '@mui/material'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

export default function SessionWarningDialog({
  onConfirm,
  onCancel,
  reason,
}: {
  onConfirm: () => void
  onCancel: () => void
  reason: PluginDefinition[]
}) {
  const [show, setShow] = useState(false)
  return (
    <Dialog open maxWidth="xl" title="Warning" onClose={onCancel}>
      <DialogContent>
        <Alert severity="warning" style={{ width: 800 }}>
          This link contains a session that has the following unknown plugins:
          <ul>
            {reason.map(r => (
              <li key={JSON.stringify(r)}>
                {pluginDescriptionString(r)} - ({pluginUrl(r)})
              </li>
            ))}
          </ul>
          Please ensure you trust the source of this session.
          <Button
            onClick={() => {
              setShow(!show)
            }}
          >
            Why am I seeing this?
          </Button>
          {show ? (
            <div>
              Sessions can load arbitrary javascript files via session plugins.
              For security purposes, we display this message when sessions
              contain plugins that are not from our plugin store
            </div>
          ) : null}
        </Alert>
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
