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
import useSWR from 'swr'
import { makeStyles } from 'tss-react/mui'

import { defaultFavs } from '../const'
import { fetchjson } from '../util'
import MoreInfoDialog from './MoreInfoDialog'
import SkeletonLoader from './SkeletonLoader'
import TablePagination from './TablePagination'
import { getColumnDefinitions } from './getColumnDefinitions'
import { useGenomesData } from './useGenomesData'

import type { Fav, LaunchCallback } from '../types'

function useAllTypes() {
  const { data, error, isLoading } = useSWR('categories', () =>
    fetchjson('https://jbrowse.org/hubs/categories.json'),
  )

  return {
    allTypes: data as
      | { categories: { key: string; title: string; url: string }[] }
      | undefined,
    isLoading,
    error,
  }
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
  const {
    allTypes,
    isLoading: allTypesLoading,
    error: allTypesError,
  } = useAllTypes()
  const url = allTypes?.categories.find(f => f.key === typeOption)?.url
  console.log({ url })

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
    url,
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

        {allTypes ? (
          <TextField
            select
            name="typeOption"
            label="Group"
            variant="outlined"
            className={classes.ml}
            value={typeOption}
            disabled={allTypesLoading}
            onChange={event => {
              setTypeOption(event.target.value)
            }}
            helperText={
              allTypesLoading
                ? 'Loading categories...'
                : allTypesError
                  ? 'Using cached categories'
                  : ''
            }
          >
            {allTypes.categories.map(({ key, title }) => (
              <MenuItem key={key} value={key}>
                {title}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
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

      {allTypesLoading ? (
        <SkeletonLoader />
      ) : finalFilteredRows.length === 0 && !genArkData && !mainGenomesData ? (
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
            totalRows={finalFilteredRows.length}
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
