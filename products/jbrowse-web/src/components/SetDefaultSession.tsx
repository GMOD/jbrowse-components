import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { DialogContent, DialogActions, Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

const SetDefaultSession = observer(function ({
  rootModel,
  onClose,
}: {
  rootModel: {
    jbrowse: {
      setDefaultSessionConf: (arg: unknown) => void
    }
    session?: unknown
  }
  onClose: () => void
}) {
  const { jbrowse, session } = rootModel

  return (
    <Dialog open onClose={onClose} title="Set default session">
      <DialogContent>
        <Typography>
          Select &quot;Set current session as default&quot; to make your current
          session saved to the config file. You can also hit &quot;Clear default
          session&quot;, which would remove the default session from the config.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            onClose()
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            jbrowse.setDefaultSessionConf({
              name: 'New session',
            })
            onClose()
          }}
        >
          Clear default session
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            jbrowse.setDefaultSessionConf(session)
            onClose()
          }}
        >
          Set current session as default session
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default SetDefaultSession
