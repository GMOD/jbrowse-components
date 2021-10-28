import React from 'react'
import { observer } from 'mobx-react'
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
    rootModel,
    open,
    onClose,
  }: {
    rootModel: {
      jbrowse: { setDefaultSessionConf: Function }
      session?: {
        notify: Function
        savedSessions: {
          name: string
          views?: {
            tracks: unknown[]
          }[]
        }[]
      }
    }
    open: boolean
    onClose: Function
  }) => {
    const classes = useStyles()
    const { session } = rootModel
    if (!session) {
      return null
    }

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
            {session?.savedSessions.length ? (
              session?.savedSessions.map(snap => {
                const { name, views = [] } = snap
                const totalTracks = views
                  .map(view => view.tracks.length)
                  .reduce((a, b) => a + b, 0)

                return (
                  <div key={JSON.stringify(snap)}>
                    <Button
                      onClick={() =>
                        rootModel.jbrowse.setDefaultSessionConf(snap)
                      }
                    >
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
              rootModel.jbrowse.setDefaultSessionConf({
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
              rootModel.jbrowse.setDefaultSessionConf(session)
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
