import { useCallback, useMemo, useState } from 'react'

import { CascadingMenuButton, ErrorMessage } from '@jbrowse/core/ui'
import { notEmpty, useLocalStorage } from '@jbrowse/core/util'
import Help from '@mui/icons-material/Help'
import MoreVert from '@mui/icons-material/MoreVert'
import { Button, IconButton } from '@mui/material'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { makeStyles } from 'tss-react/mui'

import CategorySelector from './CategorySelector'
import MoreInfoDialog from './MoreInfoDialog'
import SearchField from './SearchField'
import SkeletonLoader from './SkeletonLoader'
import TablePagination from './TablePagination'
import { getColumnDefinitions } from './getColumnDefinitions'
import { useGenomesData } from './useGenomesData'
import defaultFavs from '../defaultFavs'
import useCategories from './useCategories'

import type { Fav, LaunchCallback } from '../types'

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
  'use no memo'
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
    'ucsc',
  )
  const [showAllColumns, setShowAllColumns] = useState(false)
  const { classes } = useStyles()
  const {
    categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useCategories()
  const url = categories?.categories.find(f => f.key === typeOption)?.url

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
            commonName: row.commonName,
            description: row.description || row.commonName,
            jbrowseConfig: row.jbrowseConfig,
            ...(row.jbrowseMinimalConfig && {
              jbrowseMinimalConfig: row.jbrowseMinimalConfig,
            }),
          },
        ])
      }
    },
    [setFavorites, favorites, favs],
  )

  const { data, error } = useGenomesData({
    searchQuery,
    filterOption,
    typeOption,
    showOnlyFavs,
    favorites,
    url,
  })

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

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    // @ts-expect-error
    data,
    columns: tableColumns,
    state: {
      sorting,
      pagination,
      rowSelection,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: (updater: any) => {
      const newSelection =
        typeof updater === 'function' ? updater(rowSelection) : updater
      setSelected(Object.keys(newSelection).filter(key => newSelection[key]))
    },
    getRowId: row => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: multipleSelection,
    autoResetPageIndex: false, // Prevent automatic page reset
  })
  return (
    <div className={classes.panel}>
      <div className={classes.span}>
        {multipleSelection ? (
          <Button
            variant="contained"
            disabled={selected.length === 0}
            onClick={() => {
              if (selected.length > 0) {
                const selectedRows = selected
                  .map(id => data.find(row => row.id === id))
                  .filter(notEmpty)
                  .map(r => ({
                    jbrowseConfig: r.jbrowseConfig,
                    shortName: r.accession,
                  }))

                launch(selectedRows)
                onClose()
              }
            }}
          >
            Go
          </Button>
        ) : null}

        <SearchField searchQuery={searchQuery} onChange={setSearchQuery} />

        <CategorySelector
          categories={categories}
          typeOption={typeOption}
          categoriesLoading={categoriesLoading}
          categoriesError={categoriesError}
          onChange={setTypeOption}
        />
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
            ...(typeOption !== 'ucsc'
              ? [
                  {
                    label: 'Show all columns',
                    type: 'checkbox' as const,
                    checked: showAllColumns,
                    onClick: () => {
                      setShowAllColumns(!showAllColumns)
                    },
                  },
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
            {
              label: 'Reset favorites list to defaults',
              type: 'normal' as const,
              onClick: () => {
                setFavorites(defaultFavs)
              },
            },
          ]}
        >
          <MoreVert />
        </CascadingMenuButton>

        <IconButton
          size="small"
          title="More information"
          onClick={() => {
            setMoreInfoDialogOpen(true)
          }}
        >
          <Help />
        </IconButton>
      </div>

      {error ? <ErrorMessage error={error} /> : null}

      {categoriesLoading ? (
        <SkeletonLoader />
      ) : data.length === 0 && !url ? (
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

          <TablePagination
            table={table}
            pagination={pagination}
            setPagination={setPagination}
            totalRows={data.length}
            displayedRows={table.getRowModel().rows.length}
          />
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
