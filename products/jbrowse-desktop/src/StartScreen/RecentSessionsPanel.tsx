import React, { useState } from 'react'
import fs from 'fs'
import { format } from 'timeago.js'
import {
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { DataGrid, GridCellParams } from '@material-ui/data-grid'
import DeleteIcon from '@material-ui/icons/Delete'
import EditIcon from '@material-ui/icons/Edit'
import RecentSessionCard from '@jbrowse/core/ui/RecentSessionCard'
import PluginManager from '@jbrowse/core/PluginManager'
import electron from 'electron'

import { createPluginManager } from './util'

const { ipcRenderer } = electron

const useStyles = makeStyles(theme => ({
  pointer: {
    cursor: 'pointer',
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },

  header: {
    margin: theme.spacing(2),
  },
}))

function RecentSessionsTable({
  dateMode,
  setError,
  sortedSessions,
  setSessionToDelete,
  setSessionToRename,
  setPluginManager,
}: {
  dateMode: string
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
            <DeleteIcon />
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
            <EditIcon />
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
        !value
          ? null
          : dateMode === 'timeago'
          ? format(value as string)
          : `${value.toLocaleString('en-US')}`,
      width: 150,
    },
    {
      field: 'birthtime',
      headerName: 'Created',
      renderCell: ({ value }: GridCellParams) =>
        !value
          ? null
          : dateMode === 'timeago'
          ? format(value as string)
          : `${value.toLocaleString('en-US')}`,
      width: 150,
    },
  ]

  const rows = sortedSessions.map(([sessionName, { stats }]) => ({
    id: sessionName,
    name: sessionName,
    rename: sessionName,
    delete: sessionName,
    birthtime: stats.birthtime,
    lastModified: stats.mtime,
  }))
  return (
    <div style={{ height: 400, width: '100%' }}>
      <DataGrid
        rows={rows}
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
          <RecentSessionCard
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
  const [displayMode, setDisplayMode] = useState('table')
  const [dateMode, setDateMode] = useState('timeago')
  return (
    <div>
      <Typography variant="h5" className={classes.header}>
        Recent sessions
      </Typography>
      <FormControl className={classes.formControl}>
        <InputLabel htmlFor="myselect">Display mode</InputLabel>
        <Select
          id="myselect"
          value={displayMode}
          onChange={event => setDisplayMode(event.target.value as string)}
        >
          <MenuItem value={'grid'}>Cards</MenuItem>
          <MenuItem value={'table'}>Table</MenuItem>
        </Select>
      </FormControl>
      <FormControl className={classes.formControl}>
        <InputLabel htmlFor="mydate">Date display mode</InputLabel>
        <Select
          id="mydate"
          value={dateMode}
          onChange={event => setDateMode(event.target.value as string)}
        >
          <MenuItem value={'datestring'}>Date string</MenuItem>
          <MenuItem value={'timeago'}>Time ago</MenuItem>
        </Select>
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
          <RecentSessionsTable
            setPluginManager={setPluginManager}
            dateMode={dateMode}
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
