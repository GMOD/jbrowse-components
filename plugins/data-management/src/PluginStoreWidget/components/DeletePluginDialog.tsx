import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'

export default function DeletePluginDialog({
  onClose,
  plugin,
}: {
  plugin: string
  onClose: (s?: string) => void
}) {
  return (
    <Dialog
      open
      onClose={() => {
        onClose()
      }}
      title={`Remove ${plugin}`}
    >
      <DialogContent>
        <Typography>
          Please confirm that you want to remove {plugin}.
        </Typography>
        <Typography color="error">
          Note: if any resources in this session still use this plugin, it may
          cause your session to crash
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            // avoid showing runtime plugin warning
            window.setTimeout(() => {
              onClose(plugin)
            }, 500)
          }}
        >
          Confirm
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            onClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
