import Button from '@material-ui/core/Button'
import CircularProgress from '@material-ui/core/CircularProgress'
import Container from '@material-ui/core/Container'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Grid from '@material-ui/core/Grid'
import Input from '@material-ui/core/Input'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
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
}))

export default function StartScreen({ root }) {
  const [sessions, setSessions] = useState()
  const [sessionNameToDelete, setSessionNameToDelete] = useState()
  const [sessionNameToRename, setSessionNameToRename] = useState()
  const [newSessionName, setNewSessionName] = useState('')

  const classes = useStyles()

  async function getSessions() {
    setSessions(await ipcRenderer.callMain('listSessions'))
  }

  useEffect(() => {
    getSessions()
  }, [])

  async function onCardClick(sessionName) {
    const sessionJSON = await ipcRenderer.callMain('loadSession', sessionName)
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
      await ipcRenderer.callMain('deleteSession', sessionNameToDelete)
      getSessions()
    }
    if (action === 'rename') {
      await ipcRenderer.callMain(
        'renameSession',
        sessionNameToRename,
        newSessionName,
      )
      getSessions()
    }
    setNewSessionName('')
    setSessionNameToDelete()
    setSessionNameToRename()
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
  if (sessionNameToRename)
    DialogComponent = (
      <>
        <DialogTitle id="alert-dialog-title">Rename</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Please enter a new name for the session:
          </DialogContentText>
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
            disabled={!newSessionName}
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
          {Object.entries(sessions)
            .filter(([, sessionData]) => sessionData.stats)
            .sort((a, b) => b[1].stats.mtimeMs - a[1].stats.mtimeMs)
            .map(([sessionName, sessionData]) => (
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
        open={Boolean(sessionNameToRename || sessionNameToDelete)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        {DialogComponent}
      </Dialog>
    </>
  )
}

StartScreen.propTypes = {
  root: MobxPropTypes.objectOrObservableObject.isRequired,
}
