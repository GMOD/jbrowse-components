import { inDevelopment } from '@gmod/jbrowse-core/util'
import Button from '@material-ui/core/Button'
import CircularProgress from '@material-ui/core/CircularProgress'
import Container from '@material-ui/core/Container'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Grid from '@material-ui/core/Grid'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Input from '@material-ui/core/Input'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListSubheader from '@material-ui/core/ListSubheader'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import {
  NewEmptySession,
  NewLinearGenomeViewSession,
  NewSVInspectorSession,
} from './NewSessionCards'
import RecentSessionCard from './RecentSessionCard'

const { electronBetterIpc = {} } = window
const { ipcRenderer } = electronBetterIpc

const useStyles = makeStyles(theme => ({
  newSession: {
    backgroundColor: theme.palette.grey['300'],
    padding: theme.spacing(2),
  },
  header: {
    margin: theme.spacing(2),
  },
  settings: {
    position: 'fixed',
    top: 8,
    left: 'calc(100% - 56px)',
  },
}))

export default function StartScreen({ root, bypass }) {
  const [sessions, setSessions] = useState()
  const [sessionNameToDelete, setSessionNameToDelete] = useState()
  const [sessionNameToRename, setSessionNameToRename] = useState()
  const [newSessionName, setNewSessionName] = useState('')
  const [menuAnchorEl, setMenuAnchorEl] = useState(null)
  const [reset, setReset] = useState(false)

  const sortedSessions =
    sessions &&
    Object.entries(sessions)
      .filter(([, sessionData]) => sessionData.stats)
      .sort((a, b) => b[1].stats.mtimeMs - a[1].stats.mtimeMs)

  if (bypass && inDevelopment && sortedSessions) {
    onCardClick(sortedSessions[0][0])
  }

  const classes = useStyles()

  async function getSessions() {
    setSessions(await ipcRenderer.invoke('listSessions'))
  }

  useEffect(() => {
    getSessions()
  }, [])

  async function onCardClick(sessionName) {
    const sessionJSON = await ipcRenderer.invoke('loadSession', sessionName)
    const sessionSnapshot = JSON.parse(sessionJSON)
    root.activateSession(sessionSnapshot)
  }

  function onDelete(sessionName) {
    setSessionNameToDelete(sessionName)
  }

  function onRename(sessionName) {
    setSessionNameToRename(sessionName)
  }

  async function handleDialogClose(action) {
    if (action === 'delete') {
      await ipcRenderer.invoke('deleteSession', sessionNameToDelete)
      getSessions()
    } else if (action === 'rename') {
      await ipcRenderer.invoke(
        'renameSession',
        sessionNameToRename,
        newSessionName,
      )
      getSessions()
    } else if (action === 'reset') {
      await ipcRenderer.invoke('reset')
      window.location.reload()
    }
    setNewSessionName('')
    setSessionNameToDelete()
    setSessionNameToRename()
    setReset(false)
  }

  function handleSettingsClick(event) {
    event.stopPropagation()
    setMenuAnchorEl(event.currentTarget)
  }

  function handleFactoryReset() {
    setReset(true)
    handleMenuClose()
  }

  function handleMenuClose() {
    setMenuAnchorEl(null)
  }

  if (!sessions)
    return (
      <CircularProgress
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          marginTop: -25,
          marginLeft: -25,
        }}
        size={50}
      />
    )

  const sessionNames = Object.keys(sessions)
  let DialogComponent = <></>
  if (sessionNameToDelete)
    DialogComponent = (
      <>
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
            onClick={() => handleDialogClose('delete')}
            color="primary"
            variant="contained"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </>
    )
  else if (sessionNameToRename)
    DialogComponent = (
      <>
        <DialogTitle id="alert-dialog-title">Rename</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Please enter a new name for the session:
          </DialogContentText>
          {sessionNames.includes(newSessionName) ? (
            <DialogContentText color="error">
              There is already a session named "{newSessionName}"
            </DialogContentText>
          ) : null}
          <Input
            autoFocus
            value={newSessionName}
            onChange={event => setNewSessionName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleDialogClose()} color="primary">
            Cancel
          </Button>
          <Button
            onClick={() => handleDialogClose('rename')}
            color="primary"
            variant="contained"
            disabled={!newSessionName || sessionNames.includes(newSessionName)}
          >
            OK
          </Button>
        </DialogActions>
      </>
    )
  else if (reset)
    DialogComponent = (
      <>
        <DialogTitle id="alert-dialog-title">Reset</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to reset? This will restore the default
            configuration and remove all sessions.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleDialogClose()} color="primary">
            Cancel
          </Button>
          <Button
            onClick={() => handleDialogClose('reset')}
            color="primary"
            variant="contained"
          >
            OK
          </Button>
        </DialogActions>
      </>
    )

  return (
    <>
      <Container maxWidth="md">
        <Typography variant="h1" align="center" className={classes.header}>
          Welcome to JBrowse
        </Typography>
        <div className={classes.newSession}>
          <Typography variant="h5" className={classes.header}>
            Start a new session
          </Typography>
          <Grid container spacing={4}>
            <Grid item>
              <NewEmptySession root={root} />
            </Grid>
            <Grid item>
              <NewLinearGenomeViewSession root={root} />
            </Grid>
            <Grid item>
              <NewSVInspectorSession root={root} />
            </Grid>
          </Grid>
        </div>
        <Typography variant="h5" className={classes.header}>
          Recent sessions
        </Typography>
        <Grid container spacing={4}>
          {sortedSessions.map(([sessionName, sessionData]) => (
            <Grid item key={sessionName}>
              <RecentSessionCard
                sessionName={sessionName}
                sessionStats={sessionData.stats}
                sessionScreenshot={sessionData.screenshot}
                onClick={onCardClick}
                onDelete={onDelete}
                onRename={onRename}
              />
            </Grid>
          ))}
        </Grid>
      </Container>
      <Dialog
        open={Boolean(sessionNameToRename || sessionNameToDelete || reset)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        {DialogComponent}
      </Dialog>
      <IconButton className={classes.settings} onClick={handleSettingsClick}>
        <Icon>settings</Icon>
      </IconButton>
      <Menu
        id="simple-menu"
        anchorEl={menuAnchorEl}
        keepMounted
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <ListSubheader>Advanced Settings</ListSubheader>
        <MenuItem onClick={() => handleFactoryReset()}>
          <ListItemIcon>
            <Icon fontSize="small">warning</Icon>
          </ListItemIcon>
          <Typography variant="inherit">Factory Reset</Typography>
        </MenuItem>
      </Menu>
    </>
  )
}

StartScreen.propTypes = {
  root: MobxPropTypes.objectOrObservableObject.isRequired,
  bypass: PropTypes.bool.isRequired,
}
