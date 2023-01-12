import React from 'react'
import { observer } from 'mobx-react'
import Dialog from '@jbrowse/core/ui/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

function canSetDefaultSession(obj: unknown): obj is {
  jbrowse: { setDefaultSessionConf: Function }
  session: unknown
} {
  return typeof obj === 'object' && !!obj && 'jbrowse' in obj
}

const SetDefaultSession = observer(
  ({ rootModel, onClose }: { rootModel?: unknown; onClose: () => void }) => {
    if (!rootModel) {
      return null
    }
    if (!canSetDefaultSession(rootModel)) {
      console.error('Incorrect rootmodel')
      return null
    }
    const { jbrowse, session } = rootModel

    return (
      <Dialog open onClose={onClose} title="Set default session">
        <DialogContent>
          <Typography>
            Select &quot;Set current session as default&quot; to make your
            current session saved to the config file. You can also hit
            &quot;Clear default session&quot;, which would remove the default
            session from the config.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              jbrowse.setDefaultSessionConf({
                name: `New session`,
              })
              onClose()
            }}
          >
            Clear default session
          </Button>
          <Button
            color="secondary"
            variant="contained"
            onClick={() => onClose()}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={() => {
              jbrowse.setDefaultSessionConf(session)
              onClose()
            }}
          >
            Set current session as default
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

export default SetDefaultSession
