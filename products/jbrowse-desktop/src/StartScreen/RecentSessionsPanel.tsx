import React, { useState } from 'react'
import fs from 'fs'
import { RootModel } from '../rootModel'
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
import electron from 'electron'

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
  rootModel,
  dateMode,
  setError,
  sortedSessions,
  setSessionToDelete,
  setSessionToRename,
}: {
  rootModel: RootModel
  dateMode: string
  setError: (e: Error) => void
  setSessionToDelete: (e: string) => void
  setSessionToRename: (e: string) => void
  sortedSessions: [string, { stats: fs.Stats }][]
}) {
  const classes = useStyles()
  const columns = [
    {
      field: 'delete',
      width: 50,
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
      width: 50,
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
                rootModel.activateSession(
                  JSON.parse(
                    await ipcRenderer.invoke('loadSession', value as string),
                  ),
                )
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

function RecentSessionsGrid({
  sortedSessions,
  rootModel,
  setError,
  setSessionToDelete,
  setSessionToRename,
}: {
  rootModel: RootModel
  setError: (e: Error) => void
  setSessionToDelete: (e: string) => void
  setSessionToRename: (e: string) => void
  sortedSessions: Session[]
}) {
  return (
    <Grid container spacing={4}>
      {sortedSessions?.map(([sessionName, sessionData]) => (
        <Grid item key={sessionName}>
          <RecentSessionCard
            sessionName={sessionName}
            sessionStats={sessionData.stats}
            sessionScreenshot={sessionData.screenshot}
            onClick={async () => {
              try {
                rootModel.activateSession(
                  JSON.parse(
                    await ipcRenderer.invoke('loadSession', sessionName),
                  ),
                )
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
  rootModel,
  sortedSessions,
  setSessionToRename,
  setSessionToDelete,
}: {
  setError: (e: Error) => void
  rootModel: RootModel
  sortedSessions: Session[]
  setSessionToRename: (e: string) => void
  setSessionToDelete: (e: string) => void
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
          <MenuItem value={'grid'}>Grid</MenuItem>
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
          <RecentSessionsGrid
            rootModel={rootModel}
            sortedSessions={sortedSessions}
            setError={setError}
            setSessionToDelete={setSessionToDelete}
            setSessionToRename={setSessionToRename}
          />
        ) : (
          <RecentSessionsTable
            rootModel={rootModel}
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
