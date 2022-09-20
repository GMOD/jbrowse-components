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
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import WarningIcon from '@mui/icons-material/Warning'
import SettingsIcon from '@mui/icons-material/Settings'

import { LogoFull, FactoryResetDialog, ErrorMessage } from '@jbrowse/core/ui'
import {
  NewEmptySession,
  NewLinearGenomeViewSession,
  NewSVInspectorSession,
} from './NewSessionCards'
import RecentSessionCard from './RecentSessionCard'

const useStyles = makeStyles()(theme => ({
  newSession: {
    backgroundColor: theme.palette?.grey['300'],
    padding: 8, // theme.spacing(2),
    marginTop: 8, // theme.spacing(6),
  },
  header: {
    margin: 8, // theme.spacing(2),
  },
  settings: {
    float: 'right',
  },
}))

const DeleteSessionDialog = ({
  sessionToDelete,
  onClose,
  rootModel,
}: {
  sessionToDelete?: string
  onClose: (_arg0: boolean) => void
  rootModel: any
}) => {
  const [deleteSession, setDeleteSession] = useState(false)
  useEffect(() => {
    ;(async () => {
      try {
        if (deleteSession) {
          setDeleteSession(false)
          rootModel.removeSavedSession({ name: sessionToDelete })
          onClose(true)
        }
      } catch (e) {
        setDeleteSession(() => {
          throw e
        })
      }
    })()
  }, [deleteSession, onClose, rootModel, sessionToDelete])

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
  rootModel,
  onFactoryReset,
}: {
  rootModel: any
  onFactoryReset: Function
}) {
  const { classes } = useStyles()

  const [sessions, setSessions] = useState<Record<string, any>>()
  const [sessionToDelete, setSessionToDelete] = useState<string>()
  const [sessionToLoad, setSessionToLoad] = useState<string>()
  const [error, setError] = useState<unknown>()
  const [updateSessionsList, setUpdateSessionsList] = useState(true)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [reset, setReset] = useState(false)

  const sessionNames = sessions !== undefined ? sessions : []
  useEffect(() => {
    ;(async () => {
      try {
        if (sessionToLoad) {
          rootModel.activateSession(sessionToLoad)
        }
      } catch (e) {
        setError(e)
      }
    })()
  }, [rootModel, sessionToLoad])

  useEffect(() => {
    ;(async () => {
      try {
        if (updateSessionsList) {
          setUpdateSessionsList(false)
          const savedRootSessions = rootModel.savedSessions.map(
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
  }, [rootModel.savedSessions, updateSessionsList])

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
        rootModel={rootModel}
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
              <NewEmptySession rootModel={rootModel} />
            </Grid>
            <Grid item>
              <NewLinearGenomeViewSession rootModel={rootModel} />
            </Grid>
            <Grid item>
              <NewSVInspectorSession rootModel={rootModel} />
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
          {error ? <ErrorMessage error={error} /> : null}
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
