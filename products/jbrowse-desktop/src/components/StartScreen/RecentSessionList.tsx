import React from 'react'
import { IconButton, Link, Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { DataGrid } from '@mui/x-data-grid'
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

function DateSinceLastUsed({ value }: { value: string }) {
  const lastModified = new Date(value)
  const now = Date.now()
  const oneDayLength = 24 * 60 * 60 * 1000
  return now - lastModified.getTime() < oneDayLength ? (
    <Tooltip title={lastModified.toLocaleString('en-US')}>
      <div>{format(lastModified)}</div>
    </Tooltip>
  ) : (
    <>{lastModified.toLocaleString('en-US')}</>
  )
}

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

  return (
    <div style={{ height: 400, width: '100%' }}>
      <DataGrid
        checkboxSelection
        disableRowSelectionOnClick
        onRowSelectionModelChange={args =>
          setSelectedSessions(sessions.filter(s => args.includes(s.path)))
        }
        rows={sessions.map(session => ({
          id: session.path,
          name: session.name,
          rename: session.name,
          delete: session.name,
          lastModified: session.updated,
          path: session.path,
        }))}
        rowHeight={25}
        columnHeaderHeight={33}
        columns={[
          {
            field: 'rename',
            minWidth: 40,
            width: 40,
            sortable: false,
            filterable: false,
            headerName: ' ',
            renderCell: params => {
              return (
                <IconButton
                  onClick={() => {
                    const { lastModified: updated, ...rest } = params.row
                    setSessionToRename({
                      ...rest,
                      updated,
                    })
                  }}
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
            renderCell: params => {
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
                  {value as string}
                </Link>
              )
            },
          },
          {
            field: 'path',
            headerName: 'Session path',
            flex: 0.7,
            renderCell: params => {
              const { value } = params
              return (
                <Tooltip title={String(value)}>
                  <div>{value as string}</div>
                </Tooltip>
              )
            },
          },
          {
            field: 'lastModified',
            headerName: 'Last modified',
            renderCell: ({ value }) =>
              !value ? null : <DateSinceLastUsed value={value} />,
            width: 150,
          },
        ]}
      />
    </div>
  )
}
