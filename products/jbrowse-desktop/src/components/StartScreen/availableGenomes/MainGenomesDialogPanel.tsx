import { useMemo, useState } from 'react'

import {
  CascadingMenuButton,
  ErrorMessage,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { measureGridWidth, notEmpty } from '@jbrowse/core/util'
import Help from '@mui/icons-material/Help'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import MoreVert from '@mui/icons-material/MoreVert'
import { Button, Link, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import useSWR from 'swr'
import { makeStyles } from 'tss-react/mui'

import { defaultFavs } from '../const'
import { fetchjson } from '../util'
import DataGridWrapper from './DataGridWrapper'
import MoreInfoDialog from './MoreInfoDialog'
import StarIcon from '../StarIcon'

import type { Fav, LaunchCallback, UCSCListGenome } from '../types'
import type { GridRowId } from '@mui/x-data-grid'

const useStyles = makeStyles()({
  ml: {
    marginLeft: 10,
  },
  span: {
    marginBottom: 20,
    marginTop: 20,
    display: 'flex',
  },
})

export default function MainGenomesDialogPanel({
  favorites,
  setFavorites,
  onClose,
  launch,
}: {
  onClose: () => void
  favorites: Fav[]
  setFavorites: (arg: Fav[]) => void
  launch: LaunchCallback
}) {
  const [selected, setSelected] = useState<Set<GridRowId>>()
  const [showOnlyFavs, setShowOnlyFavs] = useState(false)
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false)
  const [multipleSelection, setMultipleSelection] = useState(false)

  const { classes } = useStyles()
  const { data: list, error } = useSWR(
    'quickstarts',
    () =>
      fetchjson('https://jbrowse.org/ucsc/list.json') as Promise<{
        ucscGenomes: Record<string, UCSCListGenome>
      }>,
  )
  const favs = new Set(favorites.map(fav => fav.id))
  const rows = useMemo(() => {
    const favs = new Set(favorites.map(fav => fav.id))
    return list
      ? Object.entries(list.ucscGenomes)
          .filter(([key]) => (showOnlyFavs ? favs.has(key) : true))
          .map(r => ({
            ...r[1],
            id: r[0],
            name: r[0],
            jbrowseConfig: `https://jbrowse.org/ucsc/${r[0]}/config.json`,
          }))
          .filter(f => !!f.id)
      : undefined
  }, [list, favorites, showOnlyFavs])

  const colNames = ['name', 'scientificName', 'organism', 'description']
  const widths = rows
    ? colNames.map(e => measureGridWidth(rows.map(r => r[e as keyof typeof r])))
    : undefined
  return (
    <div>
      <div className={classes.span}>
        <Typography variant="h6">Main genome browsers</Typography>
        {multipleSelection ? (
          <Button
            className={classes.ml}
            onClick={() => {
              if (selected && rows) {
                const r3 = Object.fromEntries(rows.map(r => [r.id, r]))
                launch(
                  [...selected]
                    .map(r => r3[r])
                    .filter(notEmpty)
                    .map(k => ({
                      shortName: k.id,
                      jbrowseConfig: k.jbrowseConfig,
                    })),
                )
              }
              onClose()
            }}
            variant="contained"
            disabled={!selected?.size}
          >
            Go
          </Button>
        ) : null}

        <CascadingMenuButton
          menuItems={[
            {
              label: 'Enable multiple selection',
              checked: multipleSelection,
              type: 'checkbox',
              onClick: () => {
                setMultipleSelection(!multipleSelection)
                setSelected(new Set())
              },
            },
            {
              label: 'Show favorites only?',
              checked: showOnlyFavs,
              type: 'checkbox',
              onClick: () => {
                setShowOnlyFavs(!showOnlyFavs)
              },
            },
            {
              label: 'Reset favorites list to defaults',
              onClick: () => {
                setFavorites(defaultFavs)
              },
            },
            {
              label: 'More information',
              icon: Help,
              onClick: () => {
                setMoreInfoDialogOpen(true)
              },
            },
          ]}
        >
          <MoreVert />
        </CascadingMenuButton>
        <div style={{ flexGrow: 1 }} />
      </div>
      <div>
        {error ? <ErrorMessage error={error} /> : null}

        <DataGridWrapper>
          {rows && widths ? (
            <DataGrid
              rows={rows}
              showToolbar
              rowHeight={25}
              columnHeaderHeight={35}
              checkboxSelection={multipleSelection}
              disableRowSelectionOnClick
              onRowSelectionModelChange={userSelectedIds => {
                setSelected(userSelectedIds.ids)
              }}
              columns={[
                {
                  field: 'name',
                  width: widths[0]! + 40,
                  renderCell: ({ row, value }) => {
                    const isFavorite = favs.has(row.id)

                    const handleLaunch = (event: React.MouseEvent) => {
                      event.preventDefault()
                      launch([
                        {
                          shortName: row.id,
                          jbrowseConfig: row.jbrowseConfig,
                        },
                      ])
                      onClose()
                    }

                    const handleToggleFavorite = () => {
                      if (isFavorite) {
                        setFavorites(favorites.filter(fav => fav.id !== row.id))
                      } else {
                        setFavorites([
                          ...favorites,
                          {
                            id: row.id,
                            shortName: row.name,
                            description: row.description,
                            jbrowseConfig: row.jbrowseConfig,
                          },
                        ])
                      }
                    }

                    return (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {multipleSelection ? (
                          value
                        ) : (
                          <Link href="#" onClick={handleLaunch}>
                            {value}
                          </Link>
                        )}
                        {isFavorite ? <StarIcon /> : null}
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
                          ]}
                        >
                          <MoreHoriz />
                        </CascadingMenuButton>
                      </div>
                    )
                  },
                },
                { field: 'scientificName', width: widths[1] },
                { field: 'organism', width: widths[2] },
                { field: 'description', width: widths[3] },
              ]}
            />
          ) : (
            <LoadingEllipses />
          )}
        </DataGridWrapper>
      </div>
      {moreInfoDialogOpen ? (
        <MoreInfoDialog
          onClose={() => {
            setMoreInfoDialogOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
