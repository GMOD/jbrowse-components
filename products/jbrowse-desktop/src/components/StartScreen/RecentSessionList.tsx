import React, { useState } from 'react'
import { IconButton, Link, Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { DataGrid } from '@mui/x-data-grid'
import PluginManager from '@jbrowse/core/PluginManager'
import { format } from 'timeago.js'

import { useResizeBar } from '@jbrowse/core/ui/useResizeBar'
import ResizeBar from '@jbrowse/core/ui/ResizeBar'

// icons
import EditIcon from '@mui/icons-material/Edit'

// locals
import { loadPluginManager, RecentSessionData } from './util'
import { measureGridWidth } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  pointer: {
    cursor: 'pointer',
  },
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
  const { classes, cx } = useStyles()
  const { ref, scrollLeft } = useResizeBar()

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
        ? format(updated)
        : date.toLocaleString('en-US'),
      updated: session.updated,
      path: session.path,
    }
  })
  const arr = ['name', 'path', 'lastModified']

  const [widths, setWidths] = useState({
    rename: 40,
    ...Object.fromEntries(
      arr.map(e => [
        e,
        measureGridWidth(
          rows.map(r => r[e as keyof (typeof rows)[0]]),
          { stripHTML: true },
        ) + 20,
      ]),
    ),
  } as Record<string, number | undefined>)

  return (
    <div ref={ref} style={{ height: 400, width: '100%' }}>
      <ResizeBar
        checkbox
        widths={Object.values(widths).map(f => f ?? 100)}
        setWidths={newWidths =>
          setWidths(
            Object.fromEntries(
              Object.entries(widths).map((entry, idx) => [
                entry[0],
                newWidths[idx],
              ]),
            ),
          )
        }
        scrollLeft={scrollLeft}
      />
      <DataGrid
        checkboxSelection
        disableRowSelectionOnClick
        onRowSelectionModelChange={args =>
          setSelectedSessions(sessions.filter(s => args.includes(s.path)))
        }
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
                  className={cx(classes.pointer, classes.cell)}
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
