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
import List from '@material-ui/core/List'
import WarningIcon from '@material-ui/icons/Warning'
import SettingsIcon from '@material-ui/icons/Settings'
import IconButton from '@material-ui/core/IconButton'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListSubheader from '@material-ui/core/ListSubheader'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import { LogoFull, FactoryResetDialog } from '@jbrowse/core/ui'
import {
  ProceedEmptySession,
  AddLinearGenomeViewToSession,
  AddSVInspectorToSession,
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
            <Grid item data-testid="emptySession">
              <ProceedEmptySession root={root} />
            </Grid>
            <Grid item data-testid="emptyLGVSession">
              <AddLinearGenomeViewToSession root={root} />
            </Grid>
            <Grid item data-testid="emptySVSession">
              <AddSVInspectorToSession root={root} />
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
            {sessionNames
              ? sessionNames.map((sessionName: string) => (
                  <RecentSessionCard
                    key={sessionName}
                    sessionName={sessionName}
                    onClick={() => {
                      setSessionToLoad(sessionName)
                    }}
                    onDelete={() => {
                      setSessionToDelete(sessionName)
                    }}
                  />
                ))
              : null}
          </List>
        </div>
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
            <WarningIcon />
          </ListItemIcon>
          <Typography variant="inherit">Reset</Typography>
        </MenuItem>
      </Menu>
    </>
  )
}

StartScreen.propTypes = {
  root: MobxPropTypes.objectOrObservableObject.isRequired,
}
