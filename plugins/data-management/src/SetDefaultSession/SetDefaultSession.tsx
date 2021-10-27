import React from 'react'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListSubheader,
  Typography,
  makeStyles,
} from '@material-ui/core'

import pluralize from 'pluralize'
import { isSessionWithSetDefaultSession } from '@jbrowse/core/util'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  message: {
    padding: theme.spacing(3),
  },
}))

const SetDefaultSession = observer(
  ({
    session,
    open,
    onClose,
  }: {
    session: unknown
    open: boolean
    onClose: Function
  }) => {
    const classes = useStyles()

    if (!isSessionWithSetDefaultSession(session)) {
      throw new Error('unsupported')
    }
    const { savedSessions } = session

    return (
      <Dialog open={open}>
        <DialogTitle>Set default session</DialogTitle>
        <DialogContent>
          <Typography>
            Choose a previously saved session (if any exist) or select "Set
            current session as default" to make your current session saved to
            the config file. You can also clear the defaultSession, which would
            just take the user to the start screen instead of any preconfigured
            default session.
          </Typography>
          <List
            subheader={<ListSubheader>Previously saved sessions</ListSubheader>}
          >
            {savedSessions.length ? (
              savedSessions.map(snap => {
                const { name, views } = snap
                const totalTracks = views
                  .map(view => view.tracks.length)
                  .reduce((a, b) => a + b, 0)

                return (
                  <div>
                    <Button onClick={() => session.setDefaultSession(snap)}>
                      {name}
                    </Button>
                    {`${views.length} ${pluralize(
                      'view',
                      views.length,
                    )}; ${totalTracks}
                             open ${pluralize('track', totalTracks)}`}
                  </div>
                )
              })
            ) : (
              <Typography className={classes.message}>
                No saved sessions found
              </Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              session.setDefaultSession({
                name: `New session`,
              })
              session.notify('Reset default session', 'success')
              onClose()
            }}
          >
            Clear default session
          </Button>
          <Button
            color="secondary"
            variant="contained"
            onClick={() => onClose(false)}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={() => {
              session.setDefaultSession(getSnapshot(session))
              session.notify('Reset default session', 'success')
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
