import React, { useState, useEffect, useMemo } from 'react'
import {
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
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
import PlaylistAddIcon from '@material-ui/icons/PlaylistAdd'

// locals
import RenameSessionDialog from './dialogs/RenameSessionDialog'
import DeleteSessionDialog from './dialogs/DeleteSessionDialog'
import { useLocalStorage, loadPluginManager } from './util'
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
  toggleButton: {
    '&.Mui-disabled': {
      pointerEvents: 'auto',
    },
  },
}))

interface RecentSessionData {
  path: string
  name: string
  screenshot?: string
  updated: number
}

type RecentSessions = RecentSessionData[]

function RecentSessionsList({
  setError,
  sessions,
  setSelectedSessions,
  setSessionToRename,
  setPluginManager,
}: {
  setError: (e: unknown) => void
  setSessionToRename: (arg: RecentSessionData) => void
  setPluginManager: (pm: PluginManager) => void
  setSelectedSessions: (arg: RecentSessionData[]) => void
  sessions: RecentSessionData[]
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
        return (
          <IconButton
            onClick={() => setSessionToRename(params.row as RecentSessionData)}
          >
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
                setPluginManager(await loadPluginManager(params.row.path))
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
      field: 'path',
      headerName: 'Session path',
      flex: 0.7,
      renderCell: (params: GridCellParams) => {
        const { value } = params
        return (
          <Tooltip title={String(value)}>
            <div>{value}</div>
          </Tooltip>
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
        const lastModified = new Date(value as string)
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
        disableSelectionOnClick
        onSelectionModelChange={args => {
          setSelectedSessions(
            sessions.filter(session => args.includes(session.path)),
          )
        }}
        rows={sessions.map(session => ({
          id: session.path,
          name: session.name,
          rename: session.name,
          delete: session.name,
          lastModified: session.updated,
          path: session.path,
        }))}
        rowHeight={25}
        headerHeight={33}
        columns={columns}
      />
    </div>
  )
}

function RecentSessionsCards({
  sessions,
  setError,
  setSessionsToDelete,
  setSessionToRename,
  setPluginManager,
  addToQuickstartList,
}: {
  setError: (e: unknown) => void
  setSessionsToDelete: (e: RecentSessionData[]) => void
  setSessionToRename: (arg: RecentSessionData) => void
  setPluginManager: (pm: PluginManager) => void
  sessions: RecentSessionData[]
  addToQuickstartList: (arg: RecentSessionData) => void
}) {
  return (
    <Grid container spacing={4}>
      {sessions?.map(session => (
        <Grid item key={session.path}>
          <SessionCard
            sessionData={session}
            onClick={async () => {
              try {
                const pm = await loadPluginManager(session.path)
                setPluginManager(pm)
              } catch (e) {
                console.error(e)
                setError(e)
              }
            }}
            onDelete={del => setSessionsToDelete([del])}
            onRename={setSessionToRename}
            onAddToQuickstartList={addToQuickstartList}
          />
        </Grid>
      ))}
    </Grid>
  )
}

// note: adjust props so disabled button can have a tooltip and not lose styling
// https://stackoverflow.com/a/63276424
function ToggleButtonWithTooltip(props: ToggleButtonProps) {
  const classes = useStyles()
  const { title = '', children, disabled, onClick, ...other } = props
  const adjustedButtonProps = {
    disabled: disabled,
    component: disabled ? 'div' : undefined,
    onClick: disabled ? undefined : onClick,
  }
  return (
    <Tooltip title={title}>
      <ToggleButton
        {...other}
        {...adjustedButtonProps}
        classes={{ root: classes.toggleButton }}
      >
        {children}
      </ToggleButton>
    </Tooltip>
  )
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
  const [sessions, setSessions] = useState<RecentSessions>([])
  const [sessionToRename, setSessionToRename] = useState<RecentSessionData>()
  const [updateSessionsList, setUpdateSessionsList] = useState(0)
  const [selectedSessions, setSelectedSessions] = useState<RecentSessions>()
  const [sessionsToDelete, setSessionsToDelete] = useState<RecentSessions>()
  const [showAutosaves, setShowAutosaves] = useLocalStorage(
    'showAutosaves',
    'false',
  )

  const sortedSessions = useMemo(
    () => sessions?.sort((a, b) => b.updated - a.updated),
    [sessions],
  )

  useEffect(() => {
    ;(async () => {
      try {
        const sessions = await ipcRenderer.invoke(
          'listSessions',
          showAutosaves === 'true',
        )
        setSessions(sessions)
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [setError, updateSessionsList, showAutosaves])

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

  async function addToQuickstartList(arg: RecentSessionData[]) {
    await Promise.all(
      arg.map(session =>
        ipcRenderer.invoke('addToQuickstartList', session.path, session.name),
      ),
    )
  }

  return (
    <div>
      <RenameSessionDialog
        sessionToRename={sessionToRename}
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
          <ToggleButtonWithTooltip
            value="quickstart"
            title="Add sessions to quickstart list"
            disabled={!selectedSessions?.length}
            onClick={() => addToQuickstartList(selectedSessions || [])}
          >
            <PlaylistAddIcon />
          </ToggleButtonWithTooltip>
        </ToggleButtonGroup>
      </FormControl>

      <FormControlLabel
        control={
          <Checkbox
            checked={showAutosaves === 'true'}
            onChange={() =>
              setShowAutosaves(showAutosaves === 'true' ? 'false' : 'true')
            }
          />
        }
        label="Show autosaves"
      />

      {sortedSessions.length ? (
        displayMode === 'grid' ? (
          <RecentSessionsCards
            addToQuickstartList={entry => addToQuickstartList([entry])}
            setPluginManager={setPluginManager}
            sessions={sortedSessions}
            setError={setError}
            setSessionsToDelete={setSessionsToDelete}
            setSessionToRename={setSessionToRename}
          />
        ) : (
          <RecentSessionsList
            setPluginManager={setPluginManager}
            sessions={sortedSessions}
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
