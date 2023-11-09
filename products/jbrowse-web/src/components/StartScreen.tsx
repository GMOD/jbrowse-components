/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { lazy, useEffect, useState } from 'react'
import {
  CircularProgress,
  Container,
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
import { LogoFull, ErrorMessage } from '@jbrowse/core/ui'

// icons
import WarningIcon from '@mui/icons-material/Warning'
import SettingsIcon from '@mui/icons-material/Settings'

// locals
import {
  NewEmptySession,
  NewLinearGenomeViewSession,
  NewSVInspectorSession,
} from './NewSessionCards'
import RecentSessionCard from './RecentSessionCard'
import { localStorageGetItem } from '@jbrowse/core/util'

// lazies
const DeleteSessionDialog = lazy(() => import('./DeleteSessionDialog'))
const FactoryResetDialog = lazy(
  () => import('@jbrowse/core/ui/FactoryResetDialog'),
)

const useStyles = makeStyles()(theme => ({
  newSession: {
    backgroundColor: theme.palette?.grey['300'],
    padding: 8,
    marginTop: 8,
  },
  header: {
    margin: 8, // theme.spacing(2),
  },
  settings: {
    float: 'right',
  },
  list: {
    overflow: 'auto',
    maxHeight: 200,
  },
}))

export default function StartScreen({
  rootModel,
  onFactoryReset,
}: {
  rootModel: any
  onFactoryReset: Function
}) {
  const { classes } = useStyles()

  const [sessionNames, setSessionNames] = useState<string[]>([])
  const [sessionToDelete, setSessionToDelete] = useState<string>()
  const [sessionToLoad, setSessionToLoad] = useState<string>()
  const [error, setError] = useState<unknown>()
  const [updateSessionsList, setUpdateSessionsList] = useState(true)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [reset, setReset] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        if (updateSessionsList) {
          setUpdateSessionsList(false)
          setSessionNames(rootModel.savedSessions.map((s: any) => s?.name))
        }
      } catch (e) {
        setError(e)
      }
    })()
  }, [rootModel.savedSessions, updateSessionsList])

  const lastAutosavedSession = JSON.parse(
    localStorageGetItem(rootModel.previousAutosaveId) || '{}',
  ).session

  return !sessionNames ? (
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
  ) : (
    <>
      {reset ? (
        <React.Suspense fallback={null}>
          <FactoryResetDialog
            open={reset}
            onFactoryReset={onFactoryReset}
            onClose={() => setReset(false)}
          />
        </React.Suspense>
      ) : null}
      {sessionToDelete ? (
        <React.Suspense fallback={null}>
          <DeleteSessionDialog
            rootModel={rootModel}
            sessionToDelete={sessionToDelete}
            onClose={update => {
              setSessionToDelete(undefined)
              setUpdateSessionsList(update)
            }}
          />
        </React.Suspense>
      ) : null}
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
          <List className={classes.list}>
            {sessionNames?.map(name => (
              <RecentSessionCard
                key={name}
                sessionName={name}
                onClick={() => setSessionToLoad(name)}
                onDelete={() => setSessionToDelete(name)}
              />
            ))}
          </List>
          {lastAutosavedSession ? (
            <>
              <Typography variant="h5" className={classes.header}>
                Last autosave session
              </Typography>
              <List className={classes.list}>
                <RecentSessionCard
                  sessionName={lastAutosavedSession.name}
                  onClick={() => rootModel.loadAutosaveSession()}
                />
              </List>
            </>
          ) : null}
          {error ? <ErrorMessage error={error} /> : null}
        </div>
      </Container>

      <Menu
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
          <Typography variant="inherit">Reset</Typography>
        </MenuItem>
      </Menu>
    </>
  )
}
