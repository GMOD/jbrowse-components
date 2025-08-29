import { useCallback, useMemo, useState } from 'react'

import { CascadingMenuButton, ErrorMessage } from '@jbrowse/core/ui'
import { notEmpty, useLocalStorage } from '@jbrowse/core/util'
import Help from '@mui/icons-material/Help'
import MoreVert from '@mui/icons-material/MoreVert'
import Search from '@mui/icons-material/Search'
import {
  Button,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { makeStyles } from 'tss-react/mui'

import { defaultFavs } from '../const'
import MoreInfoDialog from './MoreInfoDialog'
import SkeletonLoader from './SkeletonLoader'
import { getColumnDefinitions } from './getColumnDefinitions'
import { useGenomesData } from './useGenomesData'

import type { Fav, LaunchCallback } from '../types'

const allTypes = {
  mainGenomes: 'UCSC Main Genomes',
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
  BRC: 'UCSC GenArk - BRC (includes VEuPathDB)',
  CCGP: 'UCSC GenArk - CCGP (California Conservation Genomics Project)',
  globalReference: 'UCSC GenArk - Global Human Reference genomes',
  HPRC: 'UCSC GenArk - HPRC (Human Pangenome Reference Consortium)',
  legacy: 'UCSC GenArk - Legacy (NCBI genomes superseded by newer versions)',
  VGP: 'UCSC GenArk - VGP (Vertebrate Genomes Project)',
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
      padding: '2px 4px',
      border: '1px solid #ddd',
      fontSize: '0.9rem',
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
})

export default function GenomesDataTable({
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
    pageSize: 50,
  })
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([])
  const [typeOption, setTypeOption] = useLocalStorage(
    'startScreen-genArkChoice',
    'mammals',
  )
  const [showAllColumns, setShowAllColumns] = useState(false)
  const { classes } = useStyles()

  const favs = useMemo(() => new Set(favorites.map(f => f.id)), [favorites])
  const toggleFavorite = useCallback(
    (row: any) => {
      const isFavorite = favs.has(row.id)
      if (isFavorite) {
        setFavorites(favorites.filter(fav => fav.id !== row.id))
      } else {
        setFavorites([
          ...favorites,
          {
            id: row.id,
            shortName: row.name || row.ncbiAssemblyName || row.accession,
            description: row.description || row.commonName,
            jbrowseConfig: row.jbrowseConfig,
          },
        ])
      }
    },
    [setFavorites, favorites, favs],
  )

  const {
    finalFilteredRows,
    genArkError,
    mainGenomesError,
    genArkData,
    mainGenomesData,
  } = useGenomesData(
    searchQuery,
    filterOption,
    typeOption,
    showOnlyFavs,
    favorites,
  )

  const tableColumns = useMemo(
    () =>
      getColumnDefinitions({
        typeOption,
        favs,
        toggleFavorite,
        launch,
        onClose,
        searchQuery,
        showAllColumns,
      }),
    [
      typeOption,
      favs,
      launch,
      onClose,
      toggleFavorite,
      searchQuery,
      showAllColumns,
    ],
  )

  // Create table instance
  const rowSelection = useMemo(
    () => Object.fromEntries(selected.map(id => [id, true])),
    [selected],
  )

  const handleRowSelectionChange = useCallback(
    (updater: any) => {
      const currentSelection = Object.fromEntries(
        selected.map(id => [id, true]),
      )
      const newSelection =
        typeof updater === 'function' ? updater(currentSelection) : updater
      const newSelectedIds = Object.keys(newSelection).filter(
        key => newSelection[key],
      )

      // Only update if the selection actually changed
      if (
        JSON.stringify(newSelectedIds.sort()) !==
        JSON.stringify(selected.sort())
      ) {
        setSelected(newSelectedIds)
      }
    },
    [selected],
  )

  const table = useReactTable({
    // @ts-expect-error
    data: finalFilteredRows,
    columns: tableColumns,
    state: {
      sorting,
      pagination,
      rowSelection,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: handleRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: multipleSelection,
    autoResetPageIndex: false, // Prevent automatic page reset
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
              if (selected.length > 0) {
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
          onChange={e => {
            setSearchQuery(e.target.value)
          }}
          variant="outlined"
          size="small"
          className={classes.ml}
          style={{ minWidth: 200 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
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
                    type: 'checkbox' as const,
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
                    type: 'subMenu' as const,
                    subMenu: [
                      {
                        label: 'All',
                        type: 'radio' as const,
                        checked: filterOption === 'all',
                        onClick: () => {
                          setFilterOption('all')
                        },
                      },
                      {
                        label: 'RefSeq only',
                        type: 'radio' as const,
                        checked: filterOption === 'refseq',
                        onClick: () => {
                          setFilterOption('refseq')
                        },
                      },
                      {
                        label: 'GenBank only',
                        type: 'radio' as const,
                        checked: filterOption === 'genbank',
                        onClick: () => {
                          setFilterOption('genbank')
                        },
                      },
                      {
                        label: 'Designated reference genome only',
                        type: 'radio' as const,
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
                    type: 'normal' as const,
                    onClick: () => {
                      setFavorites(defaultFavs)
                    },
                  },
                ]
              : []),
            {
              label: 'More information',
              type: 'normal' as const,
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

      {finalFilteredRows.length === 0 && !genArkData && !mainGenomesData ? (
        <SkeletonLoader />
      ) : (
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
                      }[header.column.getIsSorted() as string] ?? ''}
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
              onClick={() => {
                table.setPageIndex(0)
              }}
              disabled={!table.getCanPreviousPage()}
            >
              {'<<'}
            </button>
            <button
              className={classes.paginationButton}
              onClick={() => {
                table.previousPage()
              }}
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
              onClick={() => {
                table.nextPage()
              }}
              disabled={!table.getCanNextPage()}
            >
              {'>'}
            </button>
            <button
              className={classes.paginationButton}
              onClick={() => {
                table.setPageIndex(table.getPageCount() - 1)
              }}
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
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
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
