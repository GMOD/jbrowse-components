import React from 'react'
import fs from 'fs'
import {
  FormControl,
  Grid,
  IconButton,
  Link,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { DataGrid, GridCellParams } from '@material-ui/data-grid'
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab'
import PluginManager from '@jbrowse/core/PluginManager'
import { ipcRenderer } from 'electron'

// icons
import DeleteIcon from '@material-ui/icons/Delete'
import EditIcon from '@material-ui/icons/Edit'
import ViewComfyIcon from '@material-ui/icons/ViewComfy'
import ListIcon from '@material-ui/icons/List'

// local
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
  setSessionToDelete,
  setSessionToRename,
  setPluginManager,
}: {
  setError: (e: Error) => void
  setSessionToDelete: (e: string) => void
  setSessionToRename: (e: string) => void
  setPluginManager: (pm: PluginManager) => void
  sortedSessions: [string, { stats: fs.Stats }][]
}) {
  const classes = useStyles()
  const columns = [
    {
      field: 'delete',
      width: 40,
      sortable: false,
      filterable: false,
      renderCell: (params: GridCellParams) => {
        const { value } = params
        return (
          <IconButton onClick={() => setSessionToDelete(value as string)}>
            <Tooltip title="Delete session">
              <DeleteIcon />
            </Tooltip>
          </IconButton>
        )
      },
    },
    {
      field: 'rename',
      width: 40,
      sortable: false,
      filterable: false,
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
                const pm = await createPluginManager(JSON.parse(data))
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
      renderCell: ({ value }: GridCellParams) =>
        !value ? null : `${value.toLocaleString('en-US')}`,
      width: 150,
    },
  ]

  return (
    <div style={{ height: 400, width: '100%' }}>
      <DataGrid
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
  setSessionToDelete,
  setSessionToRename,
  setPluginManager,
}: {
  setError: (e: Error) => void
  setSessionToDelete: (e: string) => void
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
                const pm = await createPluginManager(JSON.parse(data))
                setPluginManager(pm)
              } catch (e) {
                console.error(e)
                setError(e)
              }
            }}
            onDelete={setSessionToDelete}
            onRename={setSessionToRename}
          />
        </Grid>
      ))}
    </Grid>
  )
}

export default function RecentSessionPanel({
  setError,
  sortedSessions,
  setSessionToRename,
  setSessionToDelete,
  setPluginManager,
}: {
  setError: (e: Error) => void
  sortedSessions: Session[]
  setSessionToRename: (e: string) => void
  setSessionToDelete: (e: string) => void
  setPluginManager: (pm: PluginManager) => void
}) {
  const classes = useStyles()
  const [displayMode, setDisplayMode] = useLocalStorage('displayMode', 'list')
  return (
    <div>
      <FormControl className={classes.formControl}>
        <ToggleButtonGroup
          exclusive
          value={displayMode}
          onChange={(_, newVal) => setDisplayMode(newVal)}
        >
          <ToggleButton value={'grid'}>
            <Tooltip title="Grid view">
              <ViewComfyIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value={'list'}>
            <Tooltip title="List view">
              <ListIcon />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </FormControl>

      {sortedSessions.length ? (
        displayMode === 'grid' ? (
          <RecentSessionsCards
            setPluginManager={setPluginManager}
            sortedSessions={sortedSessions}
            setError={setError}
            setSessionToDelete={setSessionToDelete}
            setSessionToRename={setSessionToRename}
          />
        ) : (
          <RecentSessionsList
            setPluginManager={setPluginManager}
            sortedSessions={sortedSessions}
            setError={setError}
            setSessionToDelete={setSessionToDelete}
            setSessionToRename={setSessionToRename}
          />
        )
      ) : (
        <Typography>No sessions available</Typography>
      )}
    </div>
  )
}
