import { useMemo, useState } from 'react'

import {
  CascadingMenuButton,
  ErrorMessage,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { measureGridWidth, notEmpty, useLocalStorage } from '@jbrowse/core/util'
import Help from '@mui/icons-material/Help'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import MoreVert from '@mui/icons-material/MoreVert'
import { Button, Link, MenuItem, TextField, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import useSWR from 'swr'
import { makeStyles } from 'tss-react/mui'

import { fetchjson } from '../util'
import DataGridWrapper from './DataGridWrapper'
import MoreInfoDialog from './MoreInfoDialog'
import StarIcon from '../StarIcon'

import type { Fav, LaunchCallback } from '../types'
import type { GridColDef, GridRowId } from '@mui/x-data-grid'

const types = [
  'bacteria',
  'birds',
  'fish',
  'fungi',
  'invertebrate',
  'mammals',
  'plants',
  'primates',
  'vertebrate',
  'viral',
  'BRC',
  'CCGP',
  'globalReference',
  'HPRC',
  'legacy',
  'VGP',
]

const useStyles = makeStyles()({
  span: {
    gap: 10,
    display: 'flex',
    marginBottom: 20,
    marginTop: 20,
  },
  panel: {
    minWidth: 1000,
    minHeight: 500,
    position: 'relative',
  },
  ml: {
    margin: 0,
    marginLeft: 10,
  },
})

interface Entry {
  jbrowseConfig: string
  accession: string
  commonName: string
  ncbiAssemblyName: string
  ncbiName: string
  ncbiRefSeqCategory: string
}

const order = {
  'Complete genome': 1,
  Chromosome: 2,
  Scaffold: 3,
  Contig: 4,
}

const columns = [
  {
    field: 'commonName',
    title: 'Common Name',
    sortable: true,
  },
  {
    field: 'assemblyStatus',
    title: 'Assembly status',
    sortable: true,
    sortComparator: (v1: string, v2: string) =>
      (order[v1 as keyof typeof order] || 0) -
      (order[v2 as keyof typeof order] || 0),
  },
  {
    field: 'submitterOrg',
    title: 'Submitter',
    sortable: false,
    extra: true,
  },
  {
    field: 'seqReleaseDate',
    title: 'Release date',
    sortable: true,
  },
  {
    field: 'scientificName',
    title: 'Scientific name',
    sortable: true,
  },
  {
    field: 'ncbiAssemblyName',
    title: 'NCBI assembly name',
    sortable: true,
  },
  {
    field: 'accession',
    title: 'Accession',
    sortable: true,
    extra: true,
  },

  {
    field: 'taxonId',
    title: 'Taxonomy ID',
    sortable: true,
    extra: true,
  },
]

export default function GenArkDataTable({
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
  const [filterOption, setFilterOption] = useState('all')
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false)
  const [multipleSelection, setMultipleSelection] = useState(false)
  const [typeOption, setTypeOption] = useLocalStorage(
    'startScreen-genArkChoice',
    'mammals',
  )
  const [showAllColumns, setShowAllColumns] = useState(false)
  const { classes } = useStyles()

  const { data, error } = useSWR(
    `genark-${typeOption}`,
    () =>
      fetchjson(
        `https://jbrowse.org/processedHubJson/${typeOption}.json`,
      ) as Promise<Entry[]>,
  )

  const preRows = useMemo(
    () =>
      data
        ?.map(r => ({
          ...r,
          id: r.accession,
        }))
        .filter(f => !!f.id),
    [data],
  )
  const rows = useMemo(() => {
    if (filterOption === 'refseq') {
      return preRows?.filter(r => r.ncbiName.startsWith('GCF_'))
    } else if (filterOption === 'genbank') {
      return preRows?.filter(r => r.ncbiName.startsWith('GCA_'))
    } else if (filterOption === 'designatedReference') {
      return preRows?.filter(r => r.ncbiRefSeqCategory === 'reference genome')
    } else {
      return preRows
    }
  }, [filterOption, preRows])

  const favs = new Set(favorites.map(r => r.id))
  const colNames = columns.map(c => c.field)
  const widths = useMemo(
    () =>
      rows
        ? Object.fromEntries(
            colNames.map(e => [
              e,
              measureGridWidth(
                rows.map(r => r[e as keyof typeof r]),
                {
                  maxWidth:
                    e === 'submitterOrg' ||
                    e === 'scientificName' ||
                    e === 'ncbiAssemblyName'
                      ? 200
                      : 400,
                },
              ),
            ]),
          )
        : undefined,
    [rows, colNames],
  )

  const visibleColumns = columns.filter(
    column => showAllColumns || !column.extra,
  )
  return (
    <div className={classes.panel}>
      <div className={classes.span}>
        <Typography variant="h6" style={{ display: 'inline', margin: 0 }}>
          GenArk genome browsers
        </Typography>

        {multipleSelection ? (
          <Button
            variant="contained"
            disabled={!selected?.size}
            onClick={() => {
              if (selected && rows) {
                const r3 = Object.fromEntries(rows.map(r => [r.accession, r]))
                launch(
                  [...selected]
                    .map(r => r3[r])
                    .filter(notEmpty)
                    .map(r => ({
                      jbrowseConfig: r.jbrowseConfig,
                      shortName: r.accession,
                    })),
                )
                onClose()
              }
            }}
          >
            Go
          </Button>
        ) : null}
        <TextField
          select
          name="typeOption"
          label="Group"
          variant="outlined"
          className={classes.ml}
          value={typeOption}
          onChange={event => {
            setTypeOption(event.target.value)
          }}
        >
          {types.map(key => (
            <MenuItem key={key} value={key}>
              {key}
            </MenuItem>
          ))}
        </TextField>
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
              label: 'Show all columns',
              type: 'checkbox',
              checked: showAllColumns,
              onClick: () => {
                setShowAllColumns(!showAllColumns)
              },
            },
            {
              label: 'Filter by NCBI status',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'All',
                  type: 'radio',
                  checked: filterOption === 'all',
                  onClick: () => {
                    setFilterOption('all')
                  },
                },
                {
                  label: 'RefSeq only',
                  type: 'radio',
                  checked: filterOption === 'refseq',
                  onClick: () => {
                    setFilterOption('refseq')
                  },
                },
                {
                  label: 'GenBank only',
                  type: 'radio',
                  checked: filterOption === 'genbank',
                  onClick: () => {
                    setFilterOption('genbank')
                  },
                },
                {
                  label: 'Designated reference genome only',
                  type: 'radio',
                  checked: filterOption === 'designatedReference',
                  onClick: () => {
                    setFilterOption('designatedReference')
                  },
                },
              ],
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

      {error ? <ErrorMessage error={error} /> : null}

      <DataGridWrapper>
        {rows && widths ? (
          <DataGrid
            rows={rows.filter(f => (showOnlyFavs ? favs.has(f.id) : true))}
            showToolbar
            rowHeight={25}
            columnHeaderHeight={35}
            checkboxSelection={multipleSelection}
            disableRowSelectionOnClick
            onRowSelectionModelChange={userSelectedIds => {
              setSelected(userSelectedIds.ids)
            }}
            columns={visibleColumns.map(c => {
              return c.field === 'commonName'
                ? ({
                    field: c.field,
                    headerName: c.title,
                    width: widths.commonName! + 40,
                    renderCell: ({ row, value }) => {
                      const isFavorite = favs.has(row.id)

                      const handleLaunch = (event: React.MouseEvent) => {
                        event.preventDefault()
                        launch([
                          {
                            jbrowseConfig: row.jbrowseConfig,
                            shortName: row.accession,
                          },
                        ])
                        onClose()
                      }

                      const handleToggleFavorite = () => {
                        if (isFavorite) {
                          setFavorites(
                            favorites.filter(fav => fav.id !== row.id),
                          )
                        } else {
                          setFavorites([
                            ...favorites,
                            {
                              id: row.id,
                              shortName: row.ncbiAssemblyName,
                              description: row.commonName,
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
                  } satisfies GridColDef<(typeof rows)[0]>)
                : ({
                    field: c.field,
                    headerName: c.title,
                    width: widths[c.field],
                    sortComparator: c.sortComparator,
                  } satisfies GridColDef<(typeof rows)[0]>)
            })}
          />
        ) : (
          <LoadingEllipses variant="h6" />
        )}
      </DataGridWrapper>
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
