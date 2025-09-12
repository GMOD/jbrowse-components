import { useCallback, useMemo } from 'react'

import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { measureGridWidth } from '@jbrowse/core/util'
import { Tooltip } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { formatDistanceToNow } from 'date-fns'
import { makeStyles } from 'tss-react/mui'

import DateSinceLastUsed from './DateSinceLastUsed'
import SessionNameCell from './SessionNameCell'
import { useInnerDims } from '../availableGenomes/util'

import type { RecentSessionData } from '../types'
import type PluginManager from '@jbrowse/core/PluginManager'

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
}: {
  setError: (e: unknown) => void
  setSessionToRename: (arg: RecentSessionData) => void
  setPluginManager: (pm: PluginManager) => void
  setSelectedSessions: (arg: RecentSessionData[]) => void
  sessions: RecentSessionData[]
  favorites: string[]
  toggleFavorite: (sessionPath: string) => void
}) {
  const { classes } = useStyles()
  const { height: innerHeight } = useInnerDims()

  // Memoize expensive calculations
  const rows = useMemo(() => {
    const now = Date.now()
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
  }, [sessions])

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
    (args: any) => {
      setSelectedSessions(sessions.filter(s => args.ids.has(s.path)))
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
        renderCell: ({ value, row }: any) => (
          <SessionNameCell
            value={value as string}
            row={row}
            isFavorite={favs.has(row.id)}
            setPluginManager={setPluginManager}
            setError={setError}
            toggleFavorite={toggleFavorite}
            setSessionToRename={setSessionToRename}
          />
        ),
      },
      {
        field: 'path',
        headerName: 'Session path',
        width: widths.path,
        renderCell: ({ value }: any) => (
          <Tooltip title={String(value)}>
            <div className={classes.cell}>{value as string}</div>
          </Tooltip>
        ),
      },
      {
        field: 'lastModified',
        headerName: 'Last modified',
        width: widths.lastModified,
        renderCell: ({ value, row }: any) =>
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
