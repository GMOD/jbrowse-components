/* eslint-disable @typescript-eslint/no-explicit-any */
import Button from '@material-ui/core/Button'
import CircularProgress from '@material-ui/core/CircularProgress'
import Container from '@material-ui/core/Container'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Grid from '@material-ui/core/Grid'
import WarningIcon from '@material-ui/icons/Warning'
import SettingsIcon from '@material-ui/icons/Settings'
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
import LogoFull from './LogoFull'
import { inDevelopment } from '../util'
import {
  NewEmptySession,
  NewLinearGenomeViewSession,
  NewSVInspectorSession,
} from './NewSessionCards'
import RecentSessionCard from './RecentSessionCard'
import FactoryResetDialog from './FactoryResetDialog'

const blankIpc = { invoke: () => {} }
const useStyles = makeStyles(theme => ({
  newSession: {
    backgroundColor: theme.palette.grey['300'],
    padding: theme.spacing(2),
    marginTop: theme.spacing(6),
  },
  header: {
    margin: theme.spacing(2),
  },
  settings: {
    float: 'right',
  },
}))

const DeleteSessionDialog = ({
  sessionToDelete,
  onClose,
}: {
  sessionToDelete?: string
  onClose: (arg0: boolean) => void
}) => {
  const ipcRenderer = window.electronBetterIpc.ipcRenderer || blankIpc
  const [deleteSession, setDeleteSession] = useState(false)
  useEffect(() => {
    ;(async () => {
      try {
        if (deleteSession) {
          setDeleteSession(false)
          await ipcRenderer.invoke('deleteSession', sessionToDelete)
          onClose(true)
        }
      } catch (e) {
        setDeleteSession(() => {
          throw e
        })
      }
    })()
  }, [deleteSession, ipcRenderer, onClose, sessionToDelete])

  return (
    <Dialog open={!!sessionToDelete} onClose={() => onClose(false)}>
      <DialogTitle id="alert-dialog-title">
        {`Delete session "${sessionToDelete}"?`}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          This action cannot be undone
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} color="primary">
          Cancel
        </Button>
        <Button
          onClick={() => {
            setDeleteSession(true)
          }}
          color="primary"
          variant="contained"
          autoFocus
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const RenameSessionDialog = ({
  sessionNames,
  sessionToRename,
  onClose,
}: {
  sessionNames: string[]
  sessionToRename?: string
  onClose: (arg0: boolean) => void
}) => {
  const ipcRenderer = window.electronBetterIpc.ipcRenderer || blankIpc
  const [newSessionName, setNewSessionName] = useState('')
  const [renameSession, setRenameSession] = useState(false)
  useEffect(() => {
    ;(async () => {
      try {
        if (renameSession) {
          setRenameSession(false)
          await ipcRenderer.invoke(
            'renameSession',
            sessionToRename,
            newSessionName,
          )
          onClose(true)
        }
      } catch (e) {
        setRenameSession(() => {
          throw e
        })
      }
    })()
  }, [ipcRenderer, newSessionName, onClose, renameSession, sessionToRename])

  return (
    <Dialog open={!!sessionToRename} onClose={() => onClose(false)}>
      <DialogTitle id="alert-dialog-title">Rename</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          Please enter a new name for the session:
        </DialogContentText>
        {sessionNames.includes(newSessionName) ? (
          <DialogContentText color="error">
            There is already a session named &quot;{newSessionName}&quot;
          </DialogContentText>
        ) : null}
        <Input
          autoFocus
          defaultValue={sessionToRename}
          onChange={event => {
            setNewSessionName(event.target.value)
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} color="primary">
          Cancel
        </Button>
        <Button
          onClick={() => {
            setRenameSession(true)
          }}
          color="primary"
          variant="contained"
          disabled={!newSessionName || sessionNames.includes(newSessionName)}
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function StartScreen({
  root,
  bypass,
  onFactoryReset,
}: {
  root: any
  bypass: boolean
  onFactoryReset: Function
}) {
  const ipcRenderer = window.electronBetterIpc.ipcRenderer || blankIpc
  const [sessions, setSessions] = useState<Record<string, any> | undefined>()
  const [sessionToDelete, setSessionToDelete] = useState<string | undefined>()
  const [sessionToRename, setSessionToRename] = useState<string | undefined>()
  const [sessionToLoad, setSessionToLoad] = useState<string | undefined>()
  const [updateSessionsList, setUpdateSessionsList] = useState(true)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [reset, setReset] = useState(false)
  const classes = useStyles()

  const sessionNames = sessions !== undefined ? Object.keys(sessions) : []
  root.setSavedSessionNames(sessionNames)

  const sortedSessions = sessions
    ? Object.entries(sessions)
        .filter(([, sessionData]: [unknown, any]) => sessionData.stats)
        .sort((a: any, b: any) => b[1].stats.mtimeMs - a[1].stats.mtimeMs)
    : []

  useEffect(() => {
    ;(async () => {
      try {
        const load =
          bypass && inDevelopment && sortedSessions.length
            ? sortedSessions[0][0]
            : sessionToLoad
        if (load) {
          root.activateSession(
            JSON.parse(await ipcRenderer.invoke('loadSession', load)),
          )
        }
      } catch (e) {
        setSessions(() => {
          throw e
        })
      }
    })()
  }, [bypass, ipcRenderer, root, sessionToLoad, sortedSessions])

  useEffect(() => {
    ;(async () => {
      try {
        if (updateSessionsList) {
          setUpdateSessionsList(false)
          setSessions(await ipcRenderer.invoke('listSessions'))
        }
      } catch (e) {
        setSessions(() => {
          throw e
        })
      }
    })()
  }, [ipcRenderer, updateSessionsList])

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

  return (
    <>
      <FactoryResetDialog
        open={reset}
        onFactoryReset={onFactoryReset}
        onClose={() => {
          setReset(false)
        }}
      />
      <RenameSessionDialog
        sessionToRename={sessionToRename}
        sessionNames={sessionNames}
        onClose={(update: boolean) => {
          setSessionToRename(undefined)
          setUpdateSessionsList(update)
        }}
      />
      <DeleteSessionDialog
        sessionToDelete={sessionToDelete}
        onClose={update => {
          setSessionToDelete(undefined)
          setUpdateSessionsList(update)
        }}
      />
      <IconButton
        className={classes.settings}
        onClick={event => {
          event.stopPropagation()
          setMenuAnchorEl(event.currentTarget)
        }}
      >
        <SettingsIcon />
      </IconButton>
      <Container maxWidth="md">
        <LogoFull />
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
          {sortedSessions
            ? sortedSessions.map(
                ([sessionName, sessionData]: [string, any]) => (
                  <Grid item key={sessionName}>
                    <RecentSessionCard
                      sessionName={sessionName}
                      sessionStats={sessionData.stats}
                      sessionScreenshot={sessionData.screenshot}
                      onClick={() => {
                        setSessionToLoad(sessionName)
                      }}
                      onDelete={() => {
                        setSessionToDelete(sessionName)
                      }}
                      onRename={() => {
                        setSessionToRename(sessionName)
                      }}
                    />
                  </Grid>
                ),
              )
            : null}
        </Grid>
      </Container>

      <Menu
        id="simple-menu"
        anchorEl={menuAnchorEl}
        keepMounted
        open={Boolean(menuAnchorEl)}
        onClose={() => {
          setMenuAnchorEl(null)
        }}
      >
        <ListSubheader>Advanced Settings</ListSubheader>
        <MenuItem
          onClick={() => {
            setReset(true)
            setMenuAnchorEl(null)
          }}
        >
          <ListItemIcon>
            <WarningIcon fontSize="small" />
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
