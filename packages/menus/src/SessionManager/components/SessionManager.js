import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(1),
  },
}))

export default observer(({ session }) => {
  const classes = useStyles()
  const [sessionIndexToDelete, setSessionIndexToDelete] = useState(null)
  const [open, setOpen] = useState(false)

  function handleDialogOpen(idx) {
    setSessionIndexToDelete(idx)
    setOpen(true)
  }

  function handleDialogClose(deleteSession = false) {
    if (deleteSession)
      session.removeSavedSession(session.savedSessions[sessionIndexToDelete])
    setSessionIndexToDelete(null)
    setOpen(false)
  }

  const sessionNameToDelete =
    sessionIndexToDelete !== null
      ? session.savedSessions[sessionIndexToDelete].name
      : ''

  return (
    <>
      <Paper className={classes.root}>
        <List
          subheader={<ListSubheader>Choose a session to open</ListSubheader>}
        >
          {session.savedSessions.map((sessionSnapshot, idx) => {
            const { views = [] } = sessionSnapshot
            const openTrackCount = views.map(view => (view.tracks || []).length)
            let viewDetails
            switch (views.length) {
              case 0: {
                viewDetails = '0 views'
                break
              }
              case 1: {
                viewDetails = `1 view, ${openTrackCount[0]} open track${
                  openTrackCount[0] === 1 ? '' : 's'
                }`
                break
              }
              case 2: {
                viewDetails = `2 views; ${openTrackCount[0]} and ${
                  openTrackCount[1]
                } open tracks`
                break
              }
              default: {
                viewDetails = `${views.length} views; ${openTrackCount
                  .slice(0, views.length - 1)
                  .join(', ')}, and ${
                  openTrackCount[views.length - 1]
                } open tracks`
                break
              }
            }
            return (
              <ListItem
                button
                disabled={session.name === sessionSnapshot.name}
                onClick={() => session.activateSession(sessionSnapshot.name)}
                key={sessionSnapshot.name}
              >
                <ListItemIcon>
                  <Icon color="secondary">view_list</Icon>
                </ListItemIcon>
                <ListItemText
                  primary={sessionSnapshot.name}
                  secondary={
                    session.name === sessionSnapshot.name
                      ? 'Currently open'
                      : viewDetails
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    disabled={session.name === sessionSnapshot.name}
                    aria-label="Delete"
                    onClick={() => handleDialogOpen(idx)}
                  >
                    <Icon color="secondary">delete</Icon>
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            )
          })}
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
