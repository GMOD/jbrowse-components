import { useCallback, useMemo, useState } from 'react'

import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { measureGridWidth } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { formatDistanceToNow } from 'date-fns'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { GridRenderCellParams, GridRowSelectionModel } from '@mui/x-data-grid'

import DateSinceLastUsed from './DateSinceLastUsed.tsx'
import SessionNameCell from './SessionNameCell.tsx'
import { useInnerDims } from '../availableGenomes/util.ts'

import type { RecentSessionData } from '../types.ts'

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

function RecentSessionsList({
  setError,
  sessions,
  setSelectedSessions,
  setSessionToRename,
  setPluginManager,
  favorites,
  toggleFavorite,
  addToQuickstartList,
}: {
  setError: (e: unknown) => void
  setSessionToRename: (arg: RecentSessionData) => void
  setPluginManager: (pm: PluginManager) => void
  setSelectedSessions: (arg: RecentSessionData[]) => void
  sessions: RecentSessionData[]
  favorites: string[]
  toggleFavorite: (sessionPath: string) => void
  addToQuickstartList?: (entry: RecentSessionData) => Promise<void>
}) {
  const { classes } = useStyles()
  const { height: innerHeight } = useInnerDims()
  const [now] = useState(() => Date.now())

  // Memoize expensive calculations
  const rows = useMemo(() => {
    const oneDayLength = 24 * 60 * 60 * 1000

    return sessions.map(session => {
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
  }, [sessions, now])

  const widths = useMemo(() => {
    const arr = ['name', 'path', 'lastModified']
    return {
      ...Object.fromEntries(
        arr.map(e => [
          e,
          e === 'path'
            ? 200
            : measureGridWidth(
                rows.map(r => r[e as keyof (typeof rows)[0]]),
                { stripHTML: true },
              ) + 40,
        ]),
      ),
    } as Record<string, number>
  }, [rows])

  const favs = useMemo(() => new Set(favorites), [favorites])

  // Memoize callback functions
  const handleRowSelectionChange = useCallback(
    (model: GridRowSelectionModel) => {
      setSelectedSessions(sessions.filter(s => model.ids.has(s.path)))
    },
    [sessions, setSelectedSessions],
  )

  // Memoize columns to prevent recreation on every render
  const columns = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Session name',
        width: widths.name,
        renderCell: ({ value, row }: GridRenderCellParams) => (
          <SessionNameCell
            value={String(value)}
            row={row}
            isFavorite={favs.has(row.id)}
            setPluginManager={setPluginManager}
            setError={setError}
            toggleFavorite={toggleFavorite}
            setSessionToRename={setSessionToRename}
            addToQuickstartList={addToQuickstartList}
          />
        ),
      },
      {
        field: 'path',
        headerName: 'Session path',
        width: widths.path,
        renderCell: ({ value }: GridRenderCellParams) => (
          <Tooltip title={String(value)}>
            <div className={classes.cell}>{String(value)}</div>
          </Tooltip>
        ),
      },
      {
        field: 'lastModified',
        headerName: 'Last modified',
        width: widths.lastModified,
        renderCell: ({ value, row }: GridRenderCellParams) =>
          !value ? null : <DateSinceLastUsed row={row} />,
      },
    ],
    [
      widths,
      favs,
      classes,
      setPluginManager,
      setError,
      toggleFavorite,
      setSessionToRename,
      addToQuickstartList,
    ],
  )

  return (
    <div style={{ maxHeight: innerHeight / 2, overflow: 'auto' }}>
      <DataGridFlexContainer>
        <DataGrid
          checkboxSelection
          disableRowSelectionOnClick
          onRowSelectionModelChange={handleRowSelectionChange}
          rows={rows}
          rowHeight={25}
          columnHeaderHeight={33}
          columns={columns}
        />
      </DataGridFlexContainer>
    </div>
  )
}

export default RecentSessionsList
