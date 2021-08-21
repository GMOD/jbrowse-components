/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react'
import {
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Input,
  ListSubheader,
  Menu,
  MenuItem,
  Typography,
  makeStyles,
} from '@material-ui/core'
import WarningIcon from '@material-ui/icons/Warning'
import SettingsIcon from '@material-ui/icons/Settings'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import { LogoFull } from '@jbrowse/core/ui/Logo'
import { inDevelopment } from '@jbrowse/core/util'
import {
  NewEmptySession,
  NewLinearGenomeViewSession,
  NewSVInspectorSession,
} from '@jbrowse/core/ui/NewSessionCards'
import RecentSessionCard from '@jbrowse/core/ui/RecentSessionCard'
import FactoryResetDialog from '@jbrowse/core/ui/FactoryResetDialog'
import electron from 'electron'

const { ipcRenderer } = electron

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
  }, [deleteSession, onClose, sessionToDelete])

  return (
    <Dialog open={!!sessionToDelete} onClose={() => onClose(false)}>
      <DialogTitle>{`Delete session "${sessionToDelete}"?`}</DialogTitle>
      <DialogContent>
        <DialogContentText>This action cannot be undone</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} color="primary">
          Cancel
        </Button>
        <Button
          onClick={() => setDeleteSession(true)}
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
  const [newSessionName, setNewSessionName] = useState('')
  const [error, setError] = useState<Error>()

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
          onChange={event => setNewSessionName(event.target.value)}
        />
        {error ? (
          <Typography color="error" variant="h6">{`${error}`}</Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} color="primary">
          Cancel
        </Button>
        <Button
          onClick={async () => {
            try {
              await ipcRenderer.invoke(
                'renameSession',
                sessionToRename,
                newSessionName,
              )
              onClose(true)
            } catch (e) {
              console.error(e)
              setError(e)
            }
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
  const [sessions, setSessions] = useState<Record<string, any>>()
  const [sessionToDelete, setSessionToDelete] = useState<string>()
  const [sessionToRename, setSessionToRename] = useState<string>()
  const [updateSessionsList, setUpdateSessionsList] = useState(true)
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
  const [reset, setReset] = useState(false)
  const [error, setError] = useState<Error>()
  const classes = useStyles()

  const sessionNames = useMemo(
    () => (sessions !== undefined ? Object.keys(sessions) : []),
    [sessions],
  )
  useEffect(() => {
    root.setSavedSessionNames(sessionNames)
  }, [root, sessionNames])

  const sortedSessions = useMemo(
    () =>
      sessions
        ? Object.entries(sessions).sort(
            (a: any, b: any) =>
              b[1].stats?.mtimeMs || 0 - a[1].stats?.mtimeMs || 0,
          )
        : [],
    [sessions],
  )

  // inDevelopment, go back to the most recent session
  useEffect(() => {
    ;(async () => {
      try {
        const load =
          bypass && inDevelopment && sortedSessions.length
            ? sortedSessions[0][0]
            : undefined
        if (load) {
          root.activateSession(
            JSON.parse(await ipcRenderer.invoke('loadSession', load)),
          )
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        if (updateSessionsList) {
          setUpdateSessionsList(false)

          const sess = await ipcRenderer.invoke('listSessions')
          setSessions(sess)
        }
      } catch (e) {
        setSessions(() => {
          throw e
        })
      }
    })()
  }, [updateSessionsList])

  if (!sessions) {
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
  }

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
        {error ? (
          <Typography color="error" variant="h6">{`${error}`}</Typography>
        ) : null}
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
          {sortedSessions?.map(([sessionName, sessionData]: [string, any]) => (
            <Grid item key={sessionName}>
              <RecentSessionCard
                sessionName={sessionName}
                sessionStats={sessionData.stats}
                sessionScreenshot={sessionData.screenshot}
                onClick={async () => {
                  try {
                    root.activateSession(
                      JSON.parse(
                        await ipcRenderer.invoke('loadSession', sessionName),
                      ),
                    )
                  } catch (e) {
                    console.error(e)
                    setError(e)
                  }
                }}
                onDelete={() => {
                  setSessionToDelete(sessionName)
                }}
                onRename={() => {
                  setSessionToRename(sessionName)
                }}
              />
            </Grid>
          ))}
        </Grid>
      </Container>

      <Menu
        id="simple-menu"
        anchorEl={menuAnchorEl}
        keepMounted
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
      >
        <ListSubheader>Advanced Settings</ListSubheader>
        <MenuItem
          onClick={() => {
            setReset(true)
            setMenuAnchorEl(null)
          }}
        >
          <ListItemIcon>
            <WarningIcon />
          </ListItemIcon>
          <Typography variant="inherit">Factory reset</Typography>
        </MenuItem>
      </Menu>
    </>
  )
}
