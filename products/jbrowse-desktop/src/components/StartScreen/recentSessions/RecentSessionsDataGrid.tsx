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
})

export default function RecentSessionsList({
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

  const favs = new Set(favorites)

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
              field: 'name',
              headerName: 'Session name',
              width: widths.name,
              renderCell: ({ value, row }) => {
                const isFavorite = favs.has(row.id)

                const handleLaunch = async () => {
                  try {
                    setPluginManager(await loadPluginManager(row.path))
                  } catch (e) {
                    console.error(e)
                    setError(e)
                  }
                }

                const handleToggleFavorite = () => {
                  toggleFavorite(row.id)
                }

                const handleRename = () => {
                  const { lastModified, ...rest } = row
                  setSessionToRename({
                    ...rest,
                  })
                }

                return (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Link
                      href="#"
                      className={classes.cell}
                      onClick={async event => {
                        event.preventDefault()
                        await handleLaunch()
                      }}
                    >
                      {value as string}
                    </Link>
                    {isFavorite ? (
                      <StarIcon style={{ marginLeft: 4, fontSize: 16 }} />
                    ) : null}
                    <CascadingMenuButton
                      menuItems={[
                        {
                          label: 'Launch',
                          onClick: handleLaunch,
                        },
                        {
                          label: isFavorite
                            ? 'Remove from favorites'
                            : 'Add to favorites',
                          onClick: handleToggleFavorite,
                        },
                        {
                          label: 'Rename',
                          onClick: handleRename,
                        },
                      ]}
                    >
                      <MoreHoriz />
                    </CascadingMenuButton>
                  </div>
                )
              },
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
