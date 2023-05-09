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
import { AbstractSessionModel } from '@jbrowse/core/util'

// icons
import DeleteIcon from '@mui/icons-material/Delete'
import ViewListIcon from '@mui/icons-material/ViewList'
import DeleteDialog from './DeleteDialog'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  message: {
    padding: theme.spacing(3),
  },
}))

interface SessionSnap {
  name: string
  views?: { tracks: unknown[] }[]
  [key: string]: unknown
}

interface SessionModel extends AbstractSessionModel {
  savedSessions: SessionSnap[]
  removeSavedSession: (arg: SessionSnap) => void
  activateSession: (arg: string) => void
  loadAutosaveSession: () => void
  previousAutosaveId: string
}

const AutosaveEntry = observer(({ session }: { session: SessionModel }) => {
  const { classes } = useStyles()
  const autosavedSession = JSON.parse(
    localStorage.getItem(session.previousAutosaveId) || '{}',
  ).session as SessionSnap

  const { views = [] } = autosavedSession || {}
  const totalTracks = views
    .map(view => view.tracks.length)
    .reduce((a, b) => a + b, 0)

  return autosavedSession ? (
    <Paper className={classes.root}>
      <List subheader={<ListSubheader>Previous autosaved entry</ListSubheader>}>
        <ListItem button onClick={() => session.loadAutosaveSession()}>
          <ListItemIcon>
            <ViewListIcon />
          </ListItemIcon>
          <ListItemText
            primary={autosavedSession.name}
            secondary={
              session.name === autosavedSession.name
                ? 'Currently open'
                : `${views.length} ${pluralize(
                    'view',
                    views.length,
                  )}; ${totalTracks}
                           open ${pluralize('track', totalTracks)}`
            }
          />
        </ListItem>
      </List>
    </Paper>
  ) : null
})

const SessionManager = observer(({ session }: { session: SessionModel }) => {
  const { classes } = useStyles()
  const [sessionIndexToDelete, setSessionIndexToDelete] = useState<number>()
  const [open, setOpen] = useState(false)

  function handleDialogClose(deleteSession = false) {
    if (deleteSession && sessionIndexToDelete !== undefined) {
      session.removeSavedSession(session.savedSessions[sessionIndexToDelete])
    }
    setSessionIndexToDelete(undefined)
    setOpen(false)
  }

  const sessionNameToDelete =
    sessionIndexToDelete !== undefined
      ? session.savedSessions[sessionIndexToDelete].name
      : ''

  return (
    <>
      <AutosaveEntry session={session} />
      <Paper className={classes.root}>
        <List subheader={<ListSubheader>Saved sessions</ListSubheader>}>
          {session.savedSessions.length ? (
            session.savedSessions.map((sessionSnapshot, idx) => {
              const { views = [] } = sessionSnapshot
              const totalTracks = views
                .map(view => view.tracks.length)
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
                      onClick={() => {
                        setSessionIndexToDelete(idx)
                        setOpen(true)
                      }}
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
      </Paper>
      <DeleteDialog
        open={open}
        sessionNameToDelete={sessionNameToDelete}
        handleClose={handleDialogClose}
      />
    </>
  )
})

export default SessionManager
