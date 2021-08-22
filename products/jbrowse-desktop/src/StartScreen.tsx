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

import FactoryResetDialog from '@jbrowse/core/ui/FactoryResetDialog'
import { LogoFull } from '@jbrowse/core/ui/Logo'

// icons
import WarningIcon from '@material-ui/icons/Warning'
import SettingsIcon from '@material-ui/icons/Settings'

// misc
import fs from 'fs'
import electron from 'electron'

// locals
import StartScreenOptionsPanel from './StartScreen/StartScreenOptionsPanel'
import DeleteSessionDialog from './StartScreen/DeleteSessionDialog'
import RenameSessionDialog from './StartScreen/RenameSessionDialog'
import RecentSessionPanel from './StartScreen/RecentSessionsPanel'
import { RootModel } from './rootModel'
import { version } from '../package.json'

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

  settings: {
    float: 'right',
  },
  logo: {
    margin: '0 auto',
    width: 500,
  },
}))

const getTime = (a: [string, SessionStats]) => +a[1].stats.mtime

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
  rootModel,
  onFactoryReset,
  setPluginManager,
}: {
  rootModel: RootModel
  onFactoryReset: Function
  setPluginManager: (arg: PluginManager) => void
}) {
  const classes = useStyles()
  const [sessions, setSessions] = useState<Record<string, SessionStats>>()
  const [sessionToDelete, setSessionToDelete] = useState<string>()
  const [sessionToRename, setSessionToRename] = useState<string>()
  const [updateSessionsList, setUpdateSessionsList] = useState(true)
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
  const [reset, setReset] = useState(false)
  const [error, setError] = useState<Error>()

  const sessionNames = useMemo(() => Object.keys(sessions || {}), [sessions])

  const sortedSessions = useMemo(
    () =>
      Object.entries(sessions || {}).sort((a, b) => getTime(b) - getTime(a)),
    [sessions],
  )

  useEffect(() => {
    ;(async () => {
      try {
        if (updateSessionsList) {
          setUpdateSessionsList(false)
          setSessions(await ipcRenderer.invoke('listSessions'))
        }
      } catch (e) {
        setError(e)
        console.error(e)
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
    <div>
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
        setError={setError}
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

      <LogoWithVersion />
      {error ? (
        <Typography color="error" variant="h6">{`${error}`}</Typography>
      ) : null}

      <div className={classes.root}>
        <Grid container spacing={3}>
          <Grid item xs={4}>
            <StartScreenOptionsPanel setPluginManager={setPluginManager} />
          </Grid>
          <Grid item xs={8}>
            <RecentSessionPanel
              sortedSessions={sortedSessions}
              setSessionToDelete={setSessionToDelete}
              setSessionToRename={setSessionToRename}
              setError={setError}
            />
          </Grid>
        </Grid>
      </div>

      <Menu
        id="simple-menu"
        anchorEl={menuAnchorEl}
        keepMounted
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
      >
        <ListSubheader>Advanced settings</ListSubheader>
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
    </div>
  )
}
