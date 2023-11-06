import React, { useState } from 'react'
import {
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  ListSubheader,
  Paper,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { observer } from 'mobx-react'
import pluralize from 'pluralize'

// icons
import DeleteIcon from '@mui/icons-material/Delete'
import ViewListIcon from '@mui/icons-material/ViewList'

// locals
import { SessionModel } from './util'
import DeleteSavedSessionDialog from './DeleteSavedSessionDialog'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  message: {
    padding: theme.spacing(3),
  },
}))

const RegularSavedSessionsList = observer(function ({
  session,
}: {
  session: SessionModel
}) {
  const { classes } = useStyles()
  const [sessionIndexToDelete, setSessionIndexToDelete] = useState<number>()

  function handleDialogClose(deleteSession = false) {
    if (deleteSession && sessionIndexToDelete !== undefined) {
      session.removeSavedSession(session.savedSessions[sessionIndexToDelete])
    }
    setSessionIndexToDelete(undefined)
  }

  const sessionNameToDelete =
    sessionIndexToDelete !== undefined
      ? session.savedSessions[sessionIndexToDelete].name
      : ''
  return (
    <Paper className={classes.root}>
      <List subheader={<ListSubheader>Saved sessions</ListSubheader>}>
        {session.savedSessions.length ? (
          session.savedSessions.map((sessionSnapshot, idx) => {
            const { views = [] } = sessionSnapshot
            const totalTracks = views
              .map(view => view.tracks?.length ?? 0)
              .reduce((a, b) => a + b, 0)
            return (
              <ListItem
                button
                disabled={session.name === sessionSnapshot.name}
                onClick={() => session.activateSession(sessionSnapshot.name)}
                key={sessionSnapshot.name}
              >
                <ListItemIcon>
                  <ViewListIcon />
                </ListItemIcon>
                <ListItemText
                  primary={sessionSnapshot.name}
                  secondary={
                    session.name === sessionSnapshot.name
                      ? 'Currently open'
                      : `${views.length} ${pluralize(
                          'view',
                          views.length,
                        )}; ${totalTracks}
                           open ${pluralize('track', totalTracks)}`
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    disabled={session.name === sessionSnapshot.name}
                    aria-label="Delete"
                    onClick={() => setSessionIndexToDelete(idx)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            )
          })
        ) : (
          <Typography className={classes.message}>
            No saved sessions found
          </Typography>
        )}
      </List>
      {sessionNameToDelete ? (
        <React.Suspense fallback={null}>
          <DeleteSavedSessionDialog
            open
            sessionNameToDelete={sessionNameToDelete}
            handleClose={handleDialogClose}
          />
        </React.Suspense>
      ) : null}
    </Paper>
  )
})

export default RegularSavedSessionsList
