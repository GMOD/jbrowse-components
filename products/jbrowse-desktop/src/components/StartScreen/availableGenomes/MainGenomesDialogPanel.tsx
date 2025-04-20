import { useMemo, useState } from 'react'

import {
  CascadingMenuButton,
  ErrorMessage,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { measureGridWidth, notEmpty } from '@jbrowse/core/util'
import Help from '@mui/icons-material/Help'
import MoreVert from '@mui/icons-material/MoreVert'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { Button, IconButton, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import useSWR from 'swr'
import { makeStyles } from 'tss-react/mui'

import { fetchjson } from '../util'
import { useInnerDims } from './util'
import { defaultFavs } from '../const'
import MoreInfoDialog from './MoreInfoDialog'

import type { Fav, LaunchCallback, UCSCListGenome } from '../types'
import type { GridRowId } from '@mui/x-data-grid'

const useStyles = makeStyles()({
  ml: {
    marginLeft: 10,
  },
  span: {
    marginBottom: 20,
    marginTop: 20,
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
  const { height: innerHeight, width: innerWidth } = useInnerDims()

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
      : undefined
  }, [list, favorites, showOnlyFavs])

  const colNames = ['name', 'scientificName', 'organism', 'description']
  const widths = rows
    ? colNames.map(e => measureGridWidth(rows.map(r => r[e as keyof typeof r])))
    : undefined
  return (
    <div>
      <div style={{ display: 'flex' }}>
        <div className={classes.span}>
          <Typography variant="h6" style={{ display: 'inline' }}>
            Main genome browsers
          </Typography>
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

          <CascadingMenuButton
            menuItems={[
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
        </div>
        <div style={{ flexGrow: 1 }} />
      </div>
      <div>
        {error ? <ErrorMessage error={error} /> : null}

        {rows && widths ? (
          <div
            style={{
              width: innerWidth * (3 / 4),
              height: innerHeight * (1 / 2),
            }}
          >
            <DataGrid
              rows={rows}
              showToolbar
              rowHeight={25}
              columnHeaderHeight={35}
              checkboxSelection
              disableRowSelectionOnClick
              onRowSelectionModelChange={userSelectedIds => {
                setSelected(userSelectedIds.ids)
              }}
              columns={[
                {
                  field: 'name',
                  width: widths[0]! + 40,
                  renderCell: ({ row, value }) => {
                    return (
                      <div>
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (favs.has(row.id)) {
                              setFavorites(
                                favorites.filter(fav => fav.id !== row.id),
                              )
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
                          }}
                        >
                          {favs.has(value) ? <StarIcon /> : <StarBorderIcon />}
                        </IconButton>{' '}
                        {value}
                      </div>
                    )
                  },
                },
                { field: 'scientificName', width: widths[1] },
                { field: 'organism', width: widths[2] },
                { field: 'description', width: widths[3] },
              ]}
            />
          </div>
        ) : (
          <LoadingEllipses />
        )}
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
