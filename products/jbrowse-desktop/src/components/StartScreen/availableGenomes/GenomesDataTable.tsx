import { useCallback, useMemo, useState } from 'react'

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
import defaultFavs from '../defaultFavs.ts'
import useCategories from './useCategories.ts'

import type { Entry, GenomeColumn } from './getColumnDefinitions.tsx'
import type { Fav, LaunchCallback } from '../types.ts'

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
  if (col.sortFn) {
    return col.sortFn(a, b)
  }
  const aVal = `${a[col.id] ?? ''}`
  const bVal = `${b[col.id] ?? ''}`
  return aVal.localeCompare(bVal)
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
  'use no memo'
  const [selected, setSelected] = useState(new Set())
  const [showOnlyFavs, setShowOnlyFavs] = useState(false)
  const [filterOption, setFilterOption] = useState('all')
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false)
  const [multipleSelection, setMultipleSelection] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [sorting, setSorting] = useState<{
    id: string
    desc: boolean
  }>()
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
    (row: Entry) => {
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

  const columns = useMemo(
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

  const sortedData = useMemo(() => {
    if (!sorting) {
      return data
    }
    const col = columns.find(c => c.id === sorting.id)
    if (!col) {
      return data
    }
    const dir = sorting.desc ? -1 : 1
    return [...data].sort((a, b) => dir * defaultSort(a, b, col))
  }, [data, sorting, columns])

  const pageRows = useMemo(() => {
    const start = pageIndex * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, pageIndex, pageSize])

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
              if (selected.size > 0) {
                const selectedRows = [...selected]
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
