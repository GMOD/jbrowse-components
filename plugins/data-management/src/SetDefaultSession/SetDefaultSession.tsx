import React from 'react'
import { observer } from 'mobx-react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@material-ui/core'

function canSetDefaultSession(
  obj: unknown,
): obj is {
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
      <Dialog open onClose={onClose}>
        <DialogTitle>Set default session</DialogTitle>
        <DialogContent>
          <Typography>
            Select "Set current session as default" to make your current session
            saved to the config file. You can also hit "Clear default session",
            which would remove the default session from the config.
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
