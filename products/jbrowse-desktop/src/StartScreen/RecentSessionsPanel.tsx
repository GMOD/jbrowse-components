import React, { useState, useEffect, useMemo } from 'react'
import fs from 'fs'
import {
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  Link,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'
import {
  ToggleButtonGroup,
  ToggleButton,
  ToggleButtonProps,
} from '@material-ui/lab'
import PluginManager from '@jbrowse/core/PluginManager'
import { format } from 'timeago.js'
import { ipcRenderer } from 'electron'

// icons
import DeleteIcon from '@material-ui/icons/Delete'
import EditIcon from '@material-ui/icons/Edit'
import ViewComfyIcon from '@material-ui/icons/ViewComfy'
import ListIcon from '@material-ui/icons/List'

// locals
import RenameSessionDialog from './dialogs/RenameSessionDialog'
import DeleteSessionDialog from './dialogs/DeleteSessionDialog'
import { useLocalStorage, createPluginManager } from './util'
import SessionCard from './SessionCard'

const useStyles = makeStyles(theme => ({
  pointer: {
    cursor: 'pointer',
  },
  formControl: {
    margin: theme.spacing(2),
  },

  header: {
    margin: theme.spacing(2),
  },
}))

function RecentSessionsList({
  setError,
  sortedSessions,
  setSelectedSessions,
  setSessionToRename,
  setPluginManager,
}: {
  setError: (e: unknown) => void
  setSessionToRename: (e: string) => void
  setPluginManager: (pm: PluginManager) => void
  setSelectedSessions: (arg: string[]) => void
  sortedSessions: [string, { stats: fs.Stats }][]
}) {
  const classes = useStyles()
  const columns = [
    {
      field: 'rename',
      minWidth: 40,
      width: 40,
      sortable: false,
      filterable: false,
      headerName: ' ',
      renderCell: (params: GridCellParams) => {
        const { value } = params
        return (
          <IconButton onClick={() => setSessionToRename(value as string)}>
            <Tooltip title="Rename session">
              <EditIcon />
            </Tooltip>
          </IconButton>
        )
      },
    },
    {
      field: 'name',
      headerName: 'Session name',
      flex: 0.7,
      renderCell: (params: GridCellParams) => {
        const { value } = params
        return (
          <Link
            className={classes.pointer}
            onClick={async () => {
              try {
                const data = await ipcRenderer.invoke('loadSession', value)
                const pm = await createPluginManager(data)
                setPluginManager(pm)
              } catch (e) {
                console.error(e)
                setError(e)
              }
            }}
          >
            {value}
          </Link>
        )
      },
    },

    {
      field: 'lastModified',
      headerName: 'Last modified',
      renderCell: ({ value }: GridCellParams) => {
        if (!value) {
          return null
        }
        const lastModified = value as Date
        const now = Date.now()
        const oneDayLength = 24 * 60 * 60 * 1000
        if (now - lastModified.getTime() < oneDayLength) {
          return (
            <Tooltip title={lastModified.toLocaleString('en-US')}>
              <div>{format(lastModified)}</div>
            </Tooltip>
          )
        }
        return lastModified.toLocaleString('en-US')
      },
      width: 150,
    },
  ]

  return (
    <div style={{ height: 400, width: '100%' }}>
      <DataGrid
        checkboxSelection
        onSelectionModelChange={args => setSelectedSessions(args as string[])}
        rows={sortedSessions.map(([sessionName, { stats }]) => ({
          id: sessionName,
          name: sessionName,
          rename: sessionName,
          delete: sessionName,
          lastModified: stats?.mtime,
        }))}
        rowHeight={25}
        headerHeight={33}
        columns={columns}
      />
    </div>
  )
}

type Session = [string, { screenshot: string; stats: fs.Stats }]

function RecentSessionsCards({
  sortedSessions,
  setError,
  setSessionsToDelete,
  setSessionToRename,
  setPluginManager,
}: {
  setError: (e: unknown) => void
  setSessionsToDelete: (e: string[]) => void
  setSessionToRename: (e: string) => void
  setPluginManager: (pm: PluginManager) => void
  sortedSessions: Session[]
}) {
  return (
    <Grid container spacing={4}>
      {sortedSessions?.map(([name, sessionData]) => (
        <Grid item key={name}>
          <SessionCard
            sessionName={name}
            sessionStats={sessionData.stats}
            sessionScreenshot={sessionData.screenshot}
            onClick={async () => {
              try {
                const data = await ipcRenderer.invoke('loadSession', name)
                const pm = await createPluginManager(data)
                setPluginManager(pm)
              } catch (e) {
                console.error(e)
                setError(e)
              }
            }}
            onDelete={(del: string) => setSessionsToDelete([del])}
            onRename={setSessionToRename}
          />
        </Grid>
      ))}
    </Grid>
  )
}

function ToggleButtonWithTooltip(props: ToggleButtonProps) {
  const { title, children, ...other } = props
  return (
    <Tooltip title={title || ''}>
      <ToggleButton {...other}>{children}</ToggleButton>
    </Tooltip>
  )
}

const getTime = (a: [string, SessionStats]) => {
  return +a[1].stats?.mtime
}

interface SessionStats {
  screenshot: string
  stats: fs.Stats
}

export default function RecentSessionPanel({
  setError,
  setPluginManager,
}: {
  setError: (e: unknown) => void
  setPluginManager: (pm: PluginManager) => void
}) {
  const classes = useStyles()
  const [displayMode, setDisplayMode] = useLocalStorage('displayMode', 'list')
  const [sessions, setSessions] = useState<Map<string, SessionStats>>()
  const [sessionsToDelete, setSessionsToDelete] = useState<string[]>()
  const [sessionToRename, setSessionToRename] = useState<string>()
  const [updateSessionsList, setUpdateSessionsList] = useState(0)
  const [selectedSessions, setSelectedSessions] = useState<string[]>()

  const sessionNames = useMemo(() => Object.keys(sessions || {}), [sessions])

  const sortedSessions = useMemo(() => {
    return sessions
      ? [...sessions.entries()].sort((a, b) => getTime(b) - getTime(a))
      : []
  }, [sessions])

  useEffect(() => {
    ;(async () => {
      try {
        const sessions = await ipcRenderer.invoke('listSessions')
        setSessions(sessions)
      } catch (e) {
        console.error(e)
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
        onClose={() => {
          setSessionToRename(undefined)
          setUpdateSessionsList(s => s + 1)
        }}
      />
      {sessionsToDelete ? (
        <DeleteSessionDialog
          setError={setError}
          sessionsToDelete={sessionsToDelete}
          onClose={() => {
            setSessionsToDelete(undefined)
            setUpdateSessionsList(s => s + 1)
          }}
        />
      ) : null}
      <FormControl className={classes.formControl}>
        <ToggleButtonGroup
          exclusive
          value={displayMode}
          onChange={(_, newVal) => setDisplayMode(newVal)}
        >
          <ToggleButtonWithTooltip value="grid" title="Grid view">
            <ViewComfyIcon />
          </ToggleButtonWithTooltip>
          <ToggleButtonWithTooltip value="list" title="List view">
            <ListIcon />
          </ToggleButtonWithTooltip>
        </ToggleButtonGroup>
      </FormControl>

      <FormControl className={classes.formControl}>
        <ToggleButtonGroup>
          <ToggleButtonWithTooltip
            value="delete"
            title="Delete sessions"
            disabled={!selectedSessions?.length}
            onClick={() => setSessionsToDelete(selectedSessions)}
          >
            <DeleteIcon />
          </ToggleButtonWithTooltip>
        </ToggleButtonGroup>
      </FormControl>

      {sortedSessions.length ? (
        displayMode === 'grid' ? (
          <RecentSessionsCards
            setPluginManager={setPluginManager}
            sortedSessions={sortedSessions}
            setError={setError}
            setSessionsToDelete={setSessionsToDelete}
            setSessionToRename={setSessionToRename}
          />
        ) : (
          <RecentSessionsList
            setPluginManager={setPluginManager}
            sortedSessions={sortedSessions}
            setError={setError}
            setSelectedSessions={setSelectedSessions}
            setSessionToRename={setSessionToRename}
          />
        )
      ) : (
        <Typography>No sessions available</Typography>
      )}
    </div>
  )
}
