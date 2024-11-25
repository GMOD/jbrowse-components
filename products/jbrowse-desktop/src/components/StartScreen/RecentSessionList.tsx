import React from 'react'
import { measureGridWidth } from '@jbrowse/core/util'
import EditIcon from '@mui/icons-material/Edit'
import { IconButton, Link, Tooltip } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { formatDistance } from 'date-fns'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import { loadPluginManager } from './util'
import type { RecentSessionData } from './util'
import type PluginManager from '@jbrowse/core/PluginManager'

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

function DateSinceLastUsed({
  row,
}: {
  row: { updated?: number; showDateTooltip: boolean; lastModified: string }
}) {
  const { updated = 0, lastModified } = row
  const date = new Date(updated)
  const { classes } = useStyles()
  return row.showDateTooltip ? (
    <Tooltip title={date.toLocaleString('en-US')}>
      <div className={classes.cell}>{lastModified}</div>
    </Tooltip>
  ) : (
    <div className={classes.cell}>{lastModified}</div>
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

  const now = Date.now()
  const oneDayLength = 24 * 60 * 60 * 1000
  const rows = sessions.map(session => {
    const { updated = 0 } = session
    const date = new Date(updated)
    const showDateTooltip = now - date.getTime() < oneDayLength

    return {
      id: session.path,
      name: session.name,
      rename: session.name,
      showDateTooltip,
      lastModified: showDateTooltip
        ? formatDistance(date, now, { addSuffix: true })
        : date.toLocaleString('en-US'),
      updated: session.updated,
      path: session.path,
    }
  })
  const arr = ['name', 'path', 'lastModified']

  const widths = {
    rename: 40,
    ...Object.fromEntries(
      arr.map(e => [
        e,
        e === 'path'
          ? 200
          : measureGridWidth(
              rows.map(r => r[e as keyof (typeof rows)[0]]),
              { stripHTML: true },
            ) + 20,
      ]),
    ),
  } as Record<string, number>

  return (
    <div style={{ height: 400, width: '100%' }}>
      <DataGrid
        checkboxSelection
        disableRowSelectionOnClick
        onRowSelectionModelChange={args => {
          setSelectedSessions(sessions.filter(s => args.includes(s.path)))
        }}
        rows={rows}
        rowHeight={25}
        columnHeaderHeight={33}
        columns={[
          {
            field: 'rename',
            minWidth: 40,
            width: widths.rename,
            sortable: false,
            filterable: false,
            headerName: ' ',
            renderCell: params => {
              return (
                <IconButton
                  onClick={() => {
                    const { lastModified, ...rest } = params.row
                    setSessionToRename({
                      ...rest,
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
            width: widths.name,
            renderCell: params => {
              const { value } = params
              return (
                <Link
                  href="#"
                  className={classes.cell}
                  onClick={async event => {
                    event.preventDefault()
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
            width: widths.path,
            renderCell: params => {
              const { value } = params
              return (
                <Tooltip title={String(value)}>
                  <div className={classes.cell}>{value as string}</div>
                </Tooltip>
              )
            },
          },
          {
            field: 'lastModified',
            headerName: 'Last modified',
            renderCell: row =>
              !row.value ? null : <DateSinceLastUsed row={row.row} />,
            width: widths.lastModified,
          },
        ]}
      />
    </div>
  )
}
