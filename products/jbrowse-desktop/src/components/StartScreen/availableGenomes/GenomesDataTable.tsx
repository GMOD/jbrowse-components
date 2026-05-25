import { useRef, useState } from 'react'

import { CascadingMenuButton, ErrorMessage } from '@jbrowse/core/ui'
import { notEmpty, useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import Help from '@mui/icons-material/Help'
import MoreVert from '@mui/icons-material/MoreVert'
import { Button, Checkbox, IconButton } from '@mui/material'
import { alpha, darken, lighten } from '@mui/material/styles'

import CategorySelector from './CategorySelector.tsx'
import MoreInfoDialog from './MoreInfoDialog.tsx'
import SearchField from './SearchField.tsx'
import SkeletonLoader from './SkeletonLoader.tsx'
import TablePagination from './TablePagination.tsx'
import { getColumnDefinitions } from './getColumnDefinitions.tsx'
import { useGenomesData } from './useGenomesData.ts'
import { useSearchHighlight } from './useSearchHighlight.ts'
import defaultFavs from '../defaultFavs.ts'
import useCategories from './useCategories.ts'

import type { Entry, GenomeColumn } from './getColumnDefinitions.tsx'
import type { Fav, LaunchCallback } from '../types.ts'
import type { FilterOption } from './useGenomesData.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const useStyles = makeStyles()(theme => {
  const borderColor =
    theme.palette.mode === 'light'
      ? lighten(alpha(theme.palette.divider, 1), 0.88)
      : darken(alpha(theme.palette.divider, 1), 0.68)
  const border = `1px solid ${borderColor}`
  return {
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
        borderBottom: border,
        fontSize: theme.typography.body2.fontSize,
      },
      '& th': {
        backgroundColor: theme.palette.background.paper,
        fontWeight: theme.typography.fontWeightMedium,
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
      },
      '& tr:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    },
    selectedRow: {
      backgroundColor: alpha(
        theme.palette.primary.main,
        theme.palette.action.selectedOpacity,
      ),
      '&:hover': {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity +
            theme.palette.action.hoverOpacity,
        ),
      },
    },
    checkboxCell: {
      padding: 0,
      textAlign: 'center',
      verticalAlign: 'middle',
    },
  }
})

const checkboxSx = {
  padding: 0,
  '& .MuiSvgIcon-root': { fontSize: '1.15rem' },
}

function defaultSort(a: Entry, b: Entry, col: GenomeColumn) {
  const aVal = `${a[col.id] ?? ''}`
  const bVal = `${b[col.id] ?? ''}`
  return col.sortFn ? col.sortFn(a, b) : aVal.localeCompare(bVal)
}

function rowToFav(row: Entry): Fav {
  return {
    id: row.id,
    shortName: row.name || row.ncbiAssemblyName || row.accession,
    commonName: row.commonName,
    description: row.description || row.commonName,
    jbrowseConfig: row.jbrowseConfig,
    jbrowseMinimalConfig: row.jbrowseMinimalConfig,
  }
}

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
  const [selected, setSelected] = useState(new Set<string>())
  const [showOnlyFavs, setShowOnlyFavs] = useState(false)
  const [filterOption, setFilterOption] = useState<FilterOption>('all')
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false)
  const [multipleSelection, setMultipleSelection] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }>()
  const [typeOption, setTypeOption] = useLocalStorage(
    'startScreen-genArkChoice',
    'ucsc',
  )
  const [showAllColumns, setShowAllColumns] = useState(false)

  // Reset to first page whenever the result set changes so we don't land on an empty page
  const setSearchQueryAndReset = (q: string) => {
    setSearchQuery(q)
    setPageIndex(0)
  }
  const setFilterOptionAndReset = (f: FilterOption) => {
    setFilterOption(f)
    setPageIndex(0)
  }
  const setTypeOptionAndReset = (t: string) => {
    setTypeOption(t)
    setPageIndex(0)
  }
  const tableRef = useRef<HTMLDivElement>(null)
  useSearchHighlight(tableRef, searchQuery)
  const { classes } = useStyles()
  const {
    categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useCategories()
  const url = categories?.categories.find(f => f.key === typeOption)?.url

  const favs = new Set(favorites.map(f => f.id))
  const toggleFavorite = (row: Entry) => {
    if (favs.has(row.id)) {
      setFavorites(favorites.filter(fav => fav.id !== row.id))
    } else {
      setFavorites([...favorites, rowToFav(row)])
    }
  }

  const { data, error } = useGenomesData({
    searchQuery,
    filterOption,
    typeOption,
    showOnlyFavs,
    favorites,
    url,
  })

  const columns = getColumnDefinitions({
    typeOption,
    favs,
    toggleFavorite,
    launch,
    onClose,
    showAllColumns,
  })

  const sortingCol =
    sorting !== undefined ? columns.find(c => c.id === sorting.id) : undefined
  const dir = sorting?.desc ? -1 : 1
  const sortedData = sortingCol
    ? [...data].sort((a, b) => dir * defaultSort(a, b, sortingCol))
    : data

  const pageRows = sortedData.slice(
    pageIndex * pageSize,
    pageIndex * pageSize + pageSize,
  )

  const toggleSort = (colId: string) => {
    if (sorting?.id === colId) {
      if (sorting.desc) {
        setSorting(undefined)
      } else {
        setSorting({ id: colId, desc: true })
      }
    } else {
      setSorting({ id: colId, desc: false })
    }
  }

  const allSelected =
    pageRows.length > 0 && pageRows.every(row => selected.has(row.id))

  const someSelected =
    !allSelected && pageRows.some(row => selected.has(row.id))

  return (
    <div className={classes.panel}>
      <div className={classes.span}>
        {multipleSelection ? (
          <Button
            variant="contained"
            disabled={selected.size === 0}
            onClick={() => {
              const selectedRows = [...selected]
                .map(id => data.find(row => row.id === id))
                .filter(notEmpty)
                .map(r => ({
                  jbrowseConfig: r.jbrowseConfig,
                  shortName: r.accession,
                }))

              launch(selectedRows)
              onClose()
            }}
          >
            Go
          </Button>
        ) : null}

        <SearchField
          searchQuery={searchQuery}
          onChange={setSearchQueryAndReset}
        />

        <CategorySelector
          categories={categories}
          typeOption={typeOption}
          categoriesLoading={categoriesLoading}
          categoriesError={categoriesError}
          onChange={setTypeOptionAndReset}
        />
        <CascadingMenuButton
          menuItems={() => [
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
                setPageIndex(0)
              },
            },
            ...(typeOption !== 'ucsc'
              ? ([
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
                          setFilterOptionAndReset('all')
                        },
                      },
                      {
                        label: 'RefSeq only',
                        type: 'radio',
                        checked: filterOption === 'refseq',
                        onClick: () => {
                          setFilterOptionAndReset('refseq')
                        },
                      },
                      {
                        label: 'GenBank only',
                        type: 'radio',
                        checked: filterOption === 'genbank',
                        onClick: () => {
                          setFilterOptionAndReset('genbank')
                        },
                      },
                      {
                        label: 'Designated reference genome only',
                        type: 'radio',
                        checked: filterOption === 'designatedReference',
                        onClick: () => {
                          setFilterOptionAndReset('designatedReference')
                        },
                      },
                    ],
                  },
                ] satisfies MenuItem[])
              : []),
            {
              label: 'Reset favorites list to defaults',
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

      {categoriesLoading || (data.length === 0 && !url) ? (
        <SkeletonLoader />
      ) : (
        <div ref={tableRef}>
          <table className={classes.table}>
            <thead>
              <tr>
                {multipleSelection ? (
                  <th className={classes.checkboxCell}>
                    <Checkbox
                      size="small"
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={() => {
                        if (allSelected) {
                          setSelected(new Set())
                        } else {
                          setSelected(new Set(pageRows.map(r => r.id)))
                        }
                      }}
                      sx={checkboxSx}
                    />
                  </th>
                ) : null}
                {columns.map(col => (
                  <th
                    key={col.id}
                    onClick={() => {
                      toggleSort(col.id)
                    }}
                  >
                    {col.header}
                    {sorting?.id === col.id ? (sorting.desc ? ' ↓' : ' ↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map(row => {
                const isSelected = selected.has(row.id)
                return (
                  <tr
                    key={row.id}
                    className={isSelected ? classes.selectedRow : undefined}
                  >
                    {multipleSelection ? (
                      <td className={classes.checkboxCell}>
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          onChange={() => {
                            const next = new Set(selected)
                            if (next.has(row.id)) {
                              next.delete(row.id)
                            } else {
                              next.add(row.id)
                            }
                            setSelected(next)
                          }}
                          sx={checkboxSx}
                        />
                      </td>
                    ) : null}
                    {columns.map(col => (
                      <td key={col.id}>
                        {col.cell ? col.cell(row) : `${row[col.id] ?? ''}`}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>

          <TablePagination
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalRows={sortedData.length}
            onPageChange={setPageIndex}
            onPageSizeChange={size => {
              setPageSize(size)
              setPageIndex(0)
            }}
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
