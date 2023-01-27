import React from 'react'
import { IconButton, Link, Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'
import PluginManager from '@jbrowse/core/PluginManager'
import { format } from 'timeago.js'

// icons
import EditIcon from '@mui/icons-material/Edit'

// locals
import { loadPluginManager, RecentSessionData } from './util'

const useStyles = makeStyles()({
  pointer: {
    cursor: 'pointer',
  },
})

export default function RecentSessionsList({
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
