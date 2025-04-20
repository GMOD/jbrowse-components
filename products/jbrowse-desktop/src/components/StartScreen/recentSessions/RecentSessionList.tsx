import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { measureGridWidth, useLocalStorage } from '@jbrowse/core/util'
import EditIcon from '@mui/icons-material/Edit'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { IconButton, Link, Tooltip } from '@mui/material'
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

  const { height: innerHeight } = useInnerDims()
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

  const [favorites, setFavorites] = useLocalStorage(
    'startScreen-favoriteSessions',
    [] as string[],
  )
  const favs = new Set(favorites)
  const toggleFavorite = (genomeName: string) => {
    if (favs.has(genomeName)) {
      setFavorites(favorites.filter(name => name !== genomeName))
    } else {
      setFavorites([...favorites, genomeName])
    }
  }

  return (
    <div style={{ maxHeight: innerHeight / 2, overflow: 'auto' }}>
      <DataGridFlexContainer>
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
              headerName: 'rename',
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
            },
            {
              field: 'fav',
              minWidth: 40,
              width: widths.rename,
              sortable: false,
              filterable: false,
              renderCell: params => (
                <Tooltip
                  title={
                    favs.has(params.row.id)
                      ? 'Remove from favorites'
                      : 'Add to favorites'
                  }
                >
                  <IconButton
                    size="small"
                    onClick={() => {
                      toggleFavorite(params.row.id)
                    }}
                  >
                    {favs.has(params.row.id) ? (
                      <StarIcon />
                    ) : (
                      <StarBorderIcon />
                    )}
                  </IconButton>
                </Tooltip>
              ),
            },
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
            },
            {
              field: 'path',
              headerName: 'Session path',
              width: widths.path,
              renderCell: ({ value }) => (
                <Tooltip title={String(value)}>
                  <div className={classes.cell}>{value as string}</div>
                </Tooltip>
              ),
            },
            {
              field: 'lastModified',
              headerName: 'Last modified',
              width: widths.lastModified,
              renderCell: ({ value, row }) =>
                !value ? null : <DateSinceLastUsed row={row} />,
            },
          ]}
        />
      </DataGridFlexContainer>
    </div>
  )
}
