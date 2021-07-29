/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react'
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
  List,
  ListItemIcon,
  ListSubheader,
  Menu,
  MenuItem,
  Typography,
  makeStyles,
} from '@material-ui/core'
import WarningIcon from '@material-ui/icons/Warning'
import SettingsIcon from '@material-ui/icons/Settings'

import { LogoFull, FactoryResetDialog } from '@jbrowse/core/ui'
import {
  NewEmptySession,
  NewLinearGenomeViewSession,
  NewSVInspectorSession,
} from '@jbrowse/core/ui/NewSessionCards'
import RecentSessionCard from './RecentSessionCard'

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
  root,
}: {
  sessionToDelete?: string
  onClose: (arg0: boolean) => void
  root: any
}) => {
  const [deleteSession, setDeleteSession] = useState(false)
  useEffect(() => {
    ;(async () => {
      try {
        if (deleteSession) {
          setDeleteSession(false)
          root.removeSavedSession({ name: sessionToDelete })
          onClose(true)
        }
      } catch (e) {
        setDeleteSession(() => {
          throw e
        })
      }
    })()
  }, [deleteSession, onClose, root, sessionToDelete])

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

export default function StartScreen({
  root,
  onFactoryReset,
}: {
  root: any
  onFactoryReset: Function
}) {
  const classes = useStyles()

  const [sessions, setSessions] = useState<Record<string, any> | undefined>()
  const [sessionToDelete, setSessionToDelete] = useState<string | undefined>()
  const [sessionToLoad, setSessionToLoad] = useState<string | undefined>()
  const [updateSessionsList, setUpdateSessionsList] = useState(true)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [reset, setReset] = useState(false)

  const sessionNames = sessions !== undefined ? sessions : []
  useEffect(() => {
    ;(async () => {
      try {
        if (sessionToLoad) {
          root.activateSession(sessionToLoad)
        }
      } catch (e) {
        setSessions(() => {
          throw e
        })
      }
    })()
  }, [root, sessionToLoad])

  useEffect(() => {
    ;(async () => {
      try {
        if (updateSessionsList) {
          setUpdateSessionsList(false)
          const savedRootSessions = root.savedSessions.map(
            (rootSavedSession: any) => {
              return JSON.parse(JSON.stringify(rootSavedSession))?.name
            },
          )
          setSessions(savedRootSessions)
        }
      } catch (e) {
        setSessions(() => {
          throw e
        })
      }
    })()
  }, [root.savedSessions, updateSessionsList])

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
      <DeleteSessionDialog
        root={root}
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
        <div>
          <Typography variant="h5" className={classes.header}>
            Recent sessions
          </Typography>
          <List
            style={{
              overflow: 'auto',
              maxHeight: 200,
            }}
          >
            {sessionNames?.map((sessionName: string) => (
              <RecentSessionCard
                key={sessionName}
                sessionName={sessionName}
                onClick={() => setSessionToLoad(sessionName)}
                onDelete={() => setSessionToDelete(sessionName)}
              />
            ))}
          </List>
        </div>
      </Container>

      <Menu
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
            <WarningIcon />
          </ListItemIcon>
          <Typography variant="inherit">Reset</Typography>
        </MenuItem>
      </Menu>
    </>
  )
}
