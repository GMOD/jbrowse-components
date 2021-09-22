import React, { useEffect, useMemo, useState } from 'react'
import {
  CircularProgress,
  Grid,
  IconButton,
  ListSubheader,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
  makeStyles,
} from '@material-ui/core'

import { LogoFull } from '@jbrowse/core/ui/Logo'
import PluginManager from '@jbrowse/core/PluginManager'

// icons
import WarningIcon from '@material-ui/icons/Warning'
import SettingsIcon from '@material-ui/icons/Settings'

// misc
import fs from 'fs'
import electron from 'electron'

// locals
import LauncherPanel from './LauncherPanel'
import RecentSessionPanel from './RecentSessionsPanel'
import RenameSessionDialog from './dialogs/RenameSessionDialog'
import DeleteSessionDialog from './dialogs/DeleteSessionDialog'
import FactoryResetDialog from './dialogs/FactoryResetDialog'
import { version } from '../../package.json'

const { ipcRenderer } = electron

const useStyles = makeStyles(theme => ({
  root: {
    marginLeft: 100,
    marginRight: 100,
    flexGrow: 1,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
    maxWidth: 300,
  },
  panel: {
    margin: theme.spacing(1),
    padding: theme.spacing(4),
    border: '1px solid black',
  },

  settings: {
    float: 'right',
  },
  logo: {
    margin: '0 auto',
    width: 500,
  },
}))

const getTime = (a: [string, SessionStats]) => {
  return +a[1].stats?.mtime
}

interface SessionStats {
  screenshot: string
  stats: fs.Stats
}

function LogoWithVersion() {
  const classes = useStyles()
  return (
    <div className={classes.logo}>
      <LogoFull />
      <Typography variant="h6" style={{ float: 'right' }}>
        v{version}
      </Typography>
    </div>
  )
}
export default function StartScreen({
  setPluginManager,
  setError,
}: {
  setPluginManager: (arg: PluginManager) => void
  setError: (arg: Error) => void
}) {
  const classes = useStyles()
  const [sessions, setSessions] = useState<Map<string, SessionStats>>()
  const [sessionToDelete, setSessionToDelete] = useState<string>()
  const [sessionToRename, setSessionToRename] = useState<string>()
  const [factoryResetDialogOpen, setFactoryResetDialogOpen] = useState(false)
  const [updateSessionsList, setUpdateSessionsList] = useState(true)
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)

  const sessionNames = useMemo(() => Object.keys(sessions || {}), [sessions])

  const sortedSessions = useMemo(() => {
    return sessions
      ? [...sessions.entries()].sort((a, b) => getTime(b) - getTime(a))
      : []
  }, [sessions])

  useEffect(() => {
    ;(async () => {
      try {
        if (updateSessionsList) {
          const sessions = await ipcRenderer.invoke('listSessions')
          setUpdateSessionsList(false)
          setSessions(sessions)
        }
      } catch (e) {
        setError(e)
      }
    })()
  }, [setError, updateSessionsList])

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
    <div>
      <RenameSessionDialog
        sessionToRename={sessionToRename}
        sessionNames={sessionNames}
        onClose={(update: boolean) => {
          setSessionToRename(undefined)
          setUpdateSessionsList(update)
        }}
      />
      <DeleteSessionDialog
        setError={setError}
        sessionToDelete={sessionToDelete}
        onClose={update => {
          setSessionToDelete(undefined)
          setUpdateSessionsList(update)
        }}
      />
      <FactoryResetDialog
        open={factoryResetDialogOpen}
        onFactoryReset={async () => {
          try {
            await ipcRenderer.invoke('reset')
            setUpdateSessionsList(true)
          } catch (e) {
            setError(e)
          } finally {
            setFactoryResetDialogOpen(false)
          }
        }}
        onClose={() => setFactoryResetDialogOpen(false)}
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

      <LogoWithVersion />

      <div className={classes.root}>
        <Grid container spacing={3}>
          <Grid item xs={4}>
            <div className={classes.panel}>
              <Typography variant="h5">Launch new session</Typography>
              <LauncherPanel setPluginManager={setPluginManager} />
            </div>
          </Grid>
          <Grid item xs={8}>
            <div className={classes.panel}>
              <Typography variant="h5">Recently opened sessions</Typography>
              <RecentSessionPanel
                setPluginManager={setPluginManager}
                sortedSessions={sortedSessions}
                setSessionToDelete={setSessionToDelete}
                setSessionToRename={setSessionToRename}
                setError={setError}
              />
            </div>
          </Grid>
        </Grid>
      </div>

      <Menu
        keepMounted
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
      >
        <ListSubheader>Advanced settings</ListSubheader>
        <MenuItem onClick={() => setFactoryResetDialogOpen(true)}>
          <ListItemIcon>
            <WarningIcon />
          </ListItemIcon>
          <Typography>Factory reset</Typography>
        </MenuItem>
      </Menu>
    </div>
  )
}
