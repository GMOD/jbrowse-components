import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import IconButton from '@material-ui/core/IconButton'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
import Paper from '@material-ui/core/Paper'
import Typography from '@material-ui/core/Typography'
import DeleteIcon from '@material-ui/icons/Delete'
import ViewListIcon from '@material-ui/icons/ViewList'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import pluralize from 'pluralize'

import React, { useState } from 'react'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  message: {
    padding: theme.spacing(3),
  },
}))

const AutosaveEntry = observer(({ session }) => {
  const classes = useStyles()
  const autosavedSession = JSON.parse(
    localStorage.getItem(session.previousAutosaveId) || '{}',
  ).session

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

const SessionManager = observer(({ session }) => {
  const classes = useStyles()
  const [sessionIndexToDelete, setSessionIndexToDelete] = useState(null)
  const [open, setOpen] = useState(false)

  function handleDialogOpen(idx) {
    setSessionIndexToDelete(idx)
    setOpen(true)
  }

  function handleDialogClose(deleteSession = false) {
    if (deleteSession) {
      session.removeSavedSession(session.savedSessions[sessionIndexToDelete])
    }
    setSessionIndexToDelete(null)
    setOpen(false)
  }

  const sessionNameToDelete =
    sessionIndexToDelete !== null
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
                      onClick={() => handleDialogOpen(idx)}
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
      <Dialog
        open={open}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {`Delete session "${sessionNameToDelete}"?`}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            This action cannot be undone
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleDialogClose()} color="primary">
            Cancel
          </Button>
          <Button
            onClick={() => handleDialogClose(true)}
            color="primary"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
})

export default SessionManager
