import { memo, useCallback, useMemo } from 'react'

import { CascadingMenuButton } from '@jbrowse/core/ui'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { measureGridWidth } from '@jbrowse/core/util'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import StarIcon from '@mui/icons-material/Star'
import { Link, Tooltip } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { formatDistanceToNow } from 'date-fns'
import { makeStyles } from 'tss-react/mui'

import DateSinceLastUsed from './DateSinceLastUsed'
import { useInnerDims } from '../availableGenomes/util'
import { loadPluginManager } from '../util'

import type { RecentSessionData } from '../types'
import type PluginManager from '@jbrowse/core/PluginManager'

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  flexContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  starIcon: {
    marginLeft: 4,
    fontSize: 16,
  },
})

// Memoized component for session name cell to prevent unnecessary re-renders
const SessionNameCell = memo(function SessionNameCell({
  value,
  row,
  isFavorite,
  classes,
  setPluginManager,
  setError,
  toggleFavorite,
  setSessionToRename,
}: {
  value: string
  row: any
  isFavorite: boolean
  classes: any
  setPluginManager: (pm: PluginManager) => void
  setError: (e: unknown) => void
  toggleFavorite: (sessionPath: string) => void
  setSessionToRename: (arg: RecentSessionData) => void
}) {
  const handleLaunch = useCallback(async () => {
    try {
      setPluginManager(await loadPluginManager(row.path))
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }, [row.path, setPluginManager, setError])

  const handleToggleFavorite = useCallback(() => {
    toggleFavorite(row.id)
  }, [row.id, toggleFavorite])

  const handleRename = useCallback(() => {
    const { lastModified, ...rest } = row
    setSessionToRename(rest)
  }, [row, setSessionToRename])

  const handleLinkClick = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault()
    await handleLaunch()
  }, [handleLaunch])

  const menuItems = useMemo(() => [
    {
      label: 'Launch',
      onClick: handleLaunch,
    },
    {
      label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
      onClick: handleToggleFavorite,
    },
    {
      label: 'Rename',
      onClick: handleRename,
    },
  ], [isFavorite, handleLaunch, handleToggleFavorite, handleRename])

  return (
    <div className={classes.flexContainer}>
      <Link href="#" className={classes.cell} onClick={handleLinkClick}>
        {value}
      </Link>
      {isFavorite ? <StarIcon className={classes.starIcon} /> : null}
      <CascadingMenuButton menuItems={menuItems}>
        <MoreHoriz />
      </CascadingMenuButton>
    </div>
  )
})

const RecentSessionsList = memo(function RecentSessionsList({
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
  const handleRowSelectionChange = useCallback((args: any) => {
    setSelectedSessions(sessions.filter(s => args.ids.has(s.path)))
  }, [sessions, setSelectedSessions])
  
  // Memoize columns to prevent recreation on every render
  const columns = useMemo(() => [
    {
      field: 'name',
      headerName: 'Session name',
      width: widths.name,
      renderCell: ({ value, row }: any) => (
        <SessionNameCell
          value={value as string}
          row={row}
          isFavorite={favs.has(row.id)}
          classes={classes}
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
  ], [widths, favs, classes, setPluginManager, setError, toggleFavorite, setSessionToRename])

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
})

export default RecentSessionsList
