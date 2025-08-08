import { useMemo, useState } from 'react'
import {
  createColumnHelper,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
} from '@tanstack/react-table'

import {
  CascadingMenuButton,
  ErrorMessage,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { notEmpty, useLocalStorage } from '@jbrowse/core/util'
import Help from '@mui/icons-material/Help'
import MoreHoriz from '@mui/icons-material/MoreHoriz'
import MoreVert from '@mui/icons-material/MoreVert'
import { Button, Link, MenuItem, TextField, Typography } from '@mui/material'
import useSWR from 'swr'
import { makeStyles } from 'tss-react/mui'

import { defaultFavs } from '../const'
import { fetchjson } from '../util'
import MoreInfoDialog from './MoreInfoDialog'
import StarIcon from '../StarIcon'

import type { Fav, LaunchCallback, UCSCListGenome } from '../types'

const allTypes = {
  mainGenomes: 'UCSC - Main Genomes',
  bacteria: 'UCSC GenArk - Bacteria',
  birds: 'UCSC GenArk - Birds',
  fish: 'UCSC GenArk - Fish',
  fungi: 'UCSC GenArk - Fungi',
  invertebrate: 'UCSC GenArk - Invertebrate',
  mammals: 'UCSC GenArk - Mammals',
  plants: 'UCSC GenArk - Plants',
  primates: 'UCSC GenArk - Primates',
  vertebrate: 'UCSC GenArk - Vertebrate',
  viral: 'UCSC GenArk - Viral',
  BRC: 'BRC (includes VEuPathDB)',
  CCGP: 'CCGP (California conservation genome project)',
  globalReference: 'Global Reference',
  HPRC: 'HPRC (Human pangenome reference consortium)',
  legacy: 'Legacy',
  VGP: 'VGP (Vertebrate genomes project)',
}

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
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    '& th, & td': {
      textAlign: 'left',
      padding: '8px 12px',
      borderBottom: '1px solid #ddd',
    },
    '& th': {
      backgroundColor: '#f5f5f5',
      fontWeight: 'bold',
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: '#e5e5e5',
      },
    },
    '& tr:hover': {
      backgroundColor: '#f9f9f9',
    },
  },
  paginationContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '1rem',
  },
  paginationButton: {
    padding: '0.3rem 1rem',
    border: '1px solid #ccc',
    borderRadius: '0.1rem',
    backgroundColor: '#f0f0f0',
    cursor: 'pointer',
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  pageInfo: {
    margin: '0 0.5rem',
  },
  searchHighlight: {
    backgroundColor: 'yellow',
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

function highlightText(text: string, query: string) {
  if (!query || !text) return text

  const queryLower = query.toLowerCase().trim()
  const textLower = text.toLowerCase()

  const index = textLower.indexOf(queryLower)
  if (index === -1) return text

  const beforeMatch = text.substring(0, index)
  const match = text.substring(index, index + query.length)
  const afterMatch = text.substring(index + query.length)

  return (
    <>
      {beforeMatch}
      <mark style={{ backgroundColor: 'yellow' }}>{match}</mark>
      {highlightText(afterMatch, query)}
    </>
  )
}

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
  const [selected, setSelected] = useState<string[]>([])
  const [showOnlyFavs, setShowOnlyFavs] = useState(false)
  const [filterOption, setFilterOption] = useState('all')
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false)
  const [multipleSelection, setMultipleSelection] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 200,
  })
  const [sorting, setSorting] = useState([])
  const [typeOption, setTypeOption] = useLocalStorage(
    'startScreen-genArkChoice',
    'mammals',
  )
  const [showAllColumns, setShowAllColumns] = useState(false)
  const { classes } = useStyles()

  const { data: genArkData, error: genArkError } = useSWR(
    typeOption === 'mainGenomes' ? null : `genark-${typeOption}`,
    () =>
      fetchjson(
        `https://jbrowse.org/processedHubJson/${typeOption}.json`,
      ) as Promise<Entry[]>,
  )

  const { data: mainGenomesData, error: mainGenomesError } = useSWR(
    typeOption === 'mainGenomes' ? 'quickstarts' : null,
    () =>
      fetchjson('https://jbrowse.org/ucsc/list.json') as Promise<{
        ucscGenomes: Record<string, UCSCListGenome>
      }>,
  )

  const preRows = useMemo(() => {
    if (typeOption === 'mainGenomes') {
      return mainGenomesData
        ? Object.entries(mainGenomesData.ucscGenomes).map(([key, value]) => ({
            ...value,
            id: key,
            name: key,
            accession: key,
            commonName: value.organism,
            jbrowseConfig: `https://jbrowse.org/ucsc/${key}/config.json`,
          }))
        : undefined
    } else {
      return genArkData
        ?.map(r => ({
          ...r,
          id: r.accession,
        }))
        .filter(f => !!f.id)
    }
  }, [typeOption, genArkData, mainGenomesData])
  const rows = useMemo(() => {
    if (typeOption === 'mainGenomes') {
      return preRows
    }
    if (filterOption === 'refseq') {
      return preRows?.filter(r => r.ncbiName?.startsWith('GCF_'))
    } else if (filterOption === 'genbank') {
      return preRows?.filter(r => r.ncbiName?.startsWith('GCA_'))
    } else if (filterOption === 'designatedReference') {
      return preRows?.filter(r => r.ncbiRefSeqCategory === 'reference genome')
    } else {
      return preRows
    }
  }, [filterOption, preRows, typeOption])

  const favs = new Set(favorites.map(r => r.id))

  // Filter rows based on search query
  const searchFilteredRows = useMemo(() => {
    if (!searchQuery.trim()) {
      return rows
    }
    const query = searchQuery.toLowerCase().trim()
    return (
      rows?.filter(row => {
        const searchText = [
          row.commonName,
          row.scientificName,
          row.ncbiAssemblyName,
          row.organism,
          row.description,
          row.name,
        ]
          .join(' ')
          .toLowerCase()
        return searchText.includes(query)
      }) || []
    )
  }, [rows, searchQuery])

  // Filter by favorites if enabled
  const finalFilteredRows = useMemo(() => {
    return showOnlyFavs
      ? searchFilteredRows?.filter(row => favs.has(row.id)) || []
      : searchFilteredRows || []
  }, [searchFilteredRows, showOnlyFavs, favs])

  // Create table columns
  const columnHelper = createColumnHelper()

  const tableColumns = useMemo(() => {
    if (typeOption === 'mainGenomes') {
      return [
        columnHelper.accessor('name', {
          header: 'Name',
          cell: info => {
            const row = info.row.original
            const isFavorite = favs.has(row.id)

            const handleLaunch = (event: React.MouseEvent) => {
              event.preventDefault()
              launch([
                {
                  jbrowseConfig: row.jbrowseConfig,
                  shortName: row.id,
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
                  highlightText(info.getValue() || '', searchQuery)
                ) : (
                  <Link href="#" onClick={handleLaunch}>
                    {highlightText(info.getValue() || '', searchQuery)}
                  </Link>
                )}
                {isFavorite ? <StarIcon /> : null}
                <CascadingMenuButton
                  menuItems={[
                    { label: 'Launch', onClick: handleLaunch },
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
        }),
        columnHelper.accessor('scientificName', {
          header: 'Scientific Name',
          cell: info => highlightText(info.getValue() || '', searchQuery),
        }),
        columnHelper.accessor('organism', {
          header: 'Organism',
          cell: info => highlightText(info.getValue() || '', searchQuery),
        }),
        columnHelper.accessor('description', {
          header: 'Description',
          cell: info => highlightText(info.getValue() || '', searchQuery),
        }),
      ]
    } else {
      const baseColumns = [
        columnHelper.accessor('commonName', {
          header: 'Common Name',
          cell: info => {
            const row = info.row.original
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
                setFavorites(favorites.filter(fav => fav.id !== row.id))
              } else {
                setFavorites([
                  ...favorites,
                  {
                    id: row.id,
                    shortName: row.ncbiAssemblyName || row.accession,
                    description: row.commonName,
                    jbrowseConfig: row.jbrowseConfig,
                  },
                ])
              }
            }

            return (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {multipleSelection ? (
                  highlightText(info.getValue() || '', searchQuery)
                ) : (
                  <Link href="#" onClick={handleLaunch}>
                    {highlightText(info.getValue() || '', searchQuery)}
                  </Link>
                )}
                {isFavorite ? <StarIcon /> : null}
                <CascadingMenuButton
                  menuItems={[
                    { label: 'Launch', onClick: handleLaunch },
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
        }),
        columnHelper.accessor('assemblyStatus', { header: 'Assembly Status' }),
        columnHelper.accessor('seqReleaseDate', { header: 'Release Date' }),
        columnHelper.accessor('scientificName', {
          header: 'Scientific Name',
          cell: info => highlightText(info.getValue() || '', searchQuery),
        }),
        columnHelper.accessor('ncbiAssemblyName', {
          header: 'NCBI Assembly Name',
          cell: info => highlightText(info.getValue() || '', searchQuery),
        }),
      ]

      const extraColumns = [
        columnHelper.accessor('accession', { header: 'Accession' }),
        columnHelper.accessor('taxonId', { header: 'Taxonomy ID' }),
        columnHelper.accessor('submitterOrg', { header: 'Submitter' }),
      ]

      return showAllColumns ? [...baseColumns, ...extraColumns] : baseColumns
    }
  }, [
    typeOption,
    favs,
    favorites,
    setFavorites,
    launch,
    onClose,
    multipleSelection,
    searchQuery,
    showAllColumns,
    columnHelper,
  ])

  // Create table instance
  const table = useReactTable({
    data: finalFilteredRows,
    columns: tableColumns,
    state: {
      sorting,
      pagination,
      rowSelection: selected.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: updater => {
      const newSelection =
        typeof updater === 'function'
          ? updater(selected.reduce((acc, id) => ({ ...acc, [id]: true }), {}))
          : updater
      setSelected(Object.keys(newSelection).filter(key => newSelection[key]))
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: multipleSelection,
  })
  return (
    <div className={classes.panel}>
      <div className={classes.span}>
        <Typography variant="h6" style={{ display: 'inline', margin: 0 }}>
          {typeOption === 'mainGenomes'
            ? 'Main genome browsers'
            : 'GenArk genome browsers'}
        </Typography>

        {multipleSelection ? (
          <Button
            variant="contained"
            disabled={selected.length === 0}
            onClick={() => {
              if (selected.length > 0 && finalFilteredRows) {
                const selectedRows = selected
                  .map(id => finalFilteredRows.find(row => row.id === id))
                  .filter(notEmpty)
                launch(
                  selectedRows.map(r => ({
                    jbrowseConfig: r.jbrowseConfig,
                    shortName:
                      typeOption === 'mainGenomes' ? r.id : r.accession,
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
          type="text"
          placeholder="Search genomes..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          variant="outlined"
          size="small"
          className={classes.ml}
          style={{ minWidth: 200 }}
        />

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
          {Object.entries(allTypes).map(([key, value]) => (
            <MenuItem key={key} value={key}>
              {value}
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
                setSelected([])
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
            ...(typeOption !== 'mainGenomes'
              ? [
                  {
                    label: 'Show all columns',
                    type: 'checkbox',
                    checked: showAllColumns,
                    onClick: () => {
                      setShowAllColumns(!showAllColumns)
                    },
                  },
                ]
              : []),
            ...(typeOption !== 'mainGenomes'
              ? [
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
                ]
              : []),
            ...(typeOption === 'mainGenomes'
              ? [
                  {
                    label: 'Reset favorites list to defaults',
                    onClick: () => {
                      setFavorites(defaultFavs)
                    },
                  },
                ]
              : []),
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

      {genArkError || mainGenomesError ? (
        <ErrorMessage error={genArkError || mainGenomesError} />
      ) : null}

      {finalFilteredRows ? (
        <div>
          <table className={classes.table}>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {multipleSelection && (
                    <th>
                      <input
                        type="checkbox"
                        checked={table.getIsAllRowsSelected()}
                        onChange={table.getToggleAllRowsSelectedHandler()}
                      />
                    </th>
                  )}
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        cursor: header.column.getCanSort()
                          ? 'pointer'
                          : 'default',
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {{
                        asc: ' ↑',
                        desc: ' ↓',
                      }[header.column.getIsSorted()] ?? ''}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id}>
                  {multipleSelection && (
                    <td>
                      <input
                        type="checkbox"
                        checked={row.getIsSelected()}
                        onChange={row.getToggleSelectedHandler()}
                      />
                    </td>
                  )}
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className={classes.paginationContainer}>
            <button
              className={classes.paginationButton}
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              {'<<'}
            </button>
            <button
              className={classes.paginationButton}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              {'<'}
            </button>
            <span className={classes.pageInfo}>
              Page{' '}
              <strong>
                {table.getState().pagination.pageIndex + 1} of{' '}
                {table.getPageCount()}
              </strong>
            </span>
            <button
              className={classes.paginationButton}
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {'>'}
            </button>
            <button
              className={classes.paginationButton}
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              {'>>'}
            </button>
            <div style={{ marginLeft: '1rem' }}>
              <label>Show:</label>
              <select
                value={pagination.pageSize}
                onChange={e => {
                  const newSize = Number(e.target.value)
                  setPagination({
                    pageIndex: 0,
                    pageSize: newSize,
                  })
                }}
                style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
              >
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
              <span style={{ marginLeft: '0.5rem' }}>rows</span>
            </div>
            <span
              style={{ marginLeft: '1rem', fontSize: '0.9rem', color: '#666' }}
            >
              Showing {table.getRowModel().rows.length} of{' '}
              {finalFilteredRows.length} rows
            </span>
          </div>
        </div>
      ) : (
        <LoadingEllipses />
      )}
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
