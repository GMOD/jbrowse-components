import { measureGridWidth } from '@jbrowse/core/util'
import EditIcon from '@mui/icons-material/Edit'
import { IconButton, Link, Tooltip } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { formatDistanceToNow } from 'date-fns'
import { makeStyles } from 'tss-react/mui'

import { loadPluginManager } from './util'

import type { RecentSessionData } from './util'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { GridColDef } from '@mui/x-data-grid'

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
        ? formatDistanceToNow(date, { addSuffix: true })
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
          setSelectedSessions(sessions.filter(s => args.ids.has(s.path)))
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
            renderCell: params => (
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
            ),
          } satisfies GridColDef<(typeof rows)[0]>,
          {
            field: 'name',
            headerName: 'Session name',
            width: widths.name,
            renderCell: ({ value, row }) => (
              <Link
                href="#"
                className={classes.cell}
                onClick={async event => {
                  event.preventDefault()
                  try {
                    setPluginManager(await loadPluginManager(row.path))
                  } catch (e) {
                    console.error(e)
                    setError(e)
                  }
                }}
              >
                {value as string}
              </Link>
            ),
          } satisfies GridColDef<(typeof rows)[0]>,
          {
            field: 'path',
            headerName: 'Session path',
            width: widths.path,
            renderCell: ({ value }) => (
              <Tooltip title={String(value)}>
                <div className={classes.cell}>{value as string}</div>
              </Tooltip>
            ),
          } satisfies GridColDef<(typeof rows)[0]>,
          {
            field: 'lastModified',
            headerName: 'Last modified',
            width: widths.lastModified,
            renderCell: ({ value, row }) =>
              !value ? null : <DateSinceLastUsed row={row} />,
          } satisfies GridColDef<(typeof rows)[0]>,
        ]}
      />
    </div>
  )
}
