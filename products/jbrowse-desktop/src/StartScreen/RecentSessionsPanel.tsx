import React, { useState, useEffect, useMemo } from 'react'
import {
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  Link,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  ToggleButtonProps,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'
import PluginManager from '@jbrowse/core/PluginManager'
import { useLocalStorage } from '@jbrowse/core/util'
import { format } from 'timeago.js'

// icons
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'
import ListIcon from '@mui/icons-material/List'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'

// locals
import RenameSessionDialog from './dialogs/RenameSessionDialog'
import DeleteSessionDialog from './dialogs/DeleteSessionDialog'
import { loadPluginManager } from './util'
import SessionCard from './SessionCard'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()({
  pointer: {
    cursor: 'pointer',
  },
  toggleButton: {
    '&.Mui-disabled': {
      pointerEvents: 'auto',
    },
  },
})

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
  const { classes } = useStyles()
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
          setSelectedSessions(sessions.filter(s => args.includes(s.path)))
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
  const { classes } = useStyles()
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
      arg.map(s => ipcRenderer.invoke('addToQuickstartList', s.path, s.name)),
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
      <Grid container spacing={4} alignItems="center">
        <Grid item>
          <FormControl>
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
        </Grid>
        <Grid item>
          <FormControl>
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
        </Grid>
        <Grid item>
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
        </Grid>
        <Grid item>
          <Button
            variant="contained"
            color="inherit"
            component="label"
            onClick={() => {}}
          >
            Open saved session (.jbrowse) file
            <input
              type="file"
              hidden
              onChange={async ({ target }) => {
                try {
                  const file = target && target.files && target.files[0]
                  if (file) {
                    const path = (file as File & { path: string }).path
                    setPluginManager(await loadPluginManager(path))
                  }
                } catch (e) {
                  console.error(e)
                  setError(e)
                }
              }}
            />
          </Button>
        </Grid>
      </Grid>

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
