import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import { getColumnDefinitions } from './getColumnDefinitions.tsx'
import { useGenomesData } from './useGenomesData.ts'
import defaultFavs from '../defaultFavs.ts'
import useCategories from './useCategories.ts'

import type { Entry, GenomeColumn } from './getColumnDefinitions.tsx'
import type { Fav, LaunchCallback } from '../types.ts'

const ROW_HEIGHT = 28
const HEADER_HEIGHT = 35
const CHECKBOX_WIDTH = 48

const checkboxSx = {
  padding: 0,
  '& .MuiSvgIcon-root': { fontSize: '1.15rem' },
}

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
    root: {
      height: 500,
      width: '100%',
      overflow: 'auto',
      border,
      borderRadius: theme.shape.borderRadius,
      background: theme.palette.background.paper,
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.body2.fontSize,
      lineHeight: theme.typography.body2.lineHeight,
      color: theme.palette.text.primary,
    },
    table: {
      minWidth: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
    },
    thead: {
      position: 'sticky',
      top: 0,
      zIndex: 1,
      background: theme.palette.background.paper,
    },
    checkboxCell: {
      padding: 0,
      textAlign: 'center',
      verticalAlign: 'middle',
      lineHeight: 0,
      borderBottom: border,
      boxSizing: 'border-box',
    },
    headerCell: {
      height: HEADER_HEIGHT,
      position: 'relative',
      textAlign: 'left',
      fontWeight: theme.typography.fontWeightMedium,
      padding: '0 10px',
      borderBottom: border,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      userSelect: 'none',
      cursor: 'pointer',
      lineHeight: `${HEADER_HEIGHT}px`,
      verticalAlign: 'middle',
      boxSizing: 'border-box',
      '&:hover': {
        background: theme.palette.action.hover,
      },
    },
    bodyRow: {
      '&:hover': {
        background: theme.palette.action.hover,
      },
    },
    selectedRow: {
      background: alpha(
        theme.palette.primary.main,
        theme.palette.action.selectedOpacity,
      ),
      '&:hover': {
        background: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity +
            theme.palette.action.hoverOpacity,
        ),
      },
    },
    bodyCell: {
      height: ROW_HEIGHT,
      padding: '0 10px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      borderBottom: border,
      lineHeight: `${ROW_HEIGHT - 1}px`,
      boxSizing: 'border-box',
    },
    resizeHandle: {
      position: 'absolute',
      right: 0,
      top: '25%',
      height: '50%',
      width: 10,
      display: 'flex',
      justifyContent: 'center',
      cursor: 'col-resize',
    },
    resizeLine: {
      width: 1,
      height: '100%',
      background: borderColor,
    },
    fillerCell: {
      borderBottom: border,
      padding: 0,
    },
  }
})

function useVirtualRows(
  parentRef: React.RefObject<HTMLDivElement | null>,
  count: number,
  rowHeight: number,
  overscan = 20,
) {
  const [scrollState, setScrollState] = useState({
    scrollTop: 0,
    clientHeight: 0,
  })

  useEffect(() => {
    const el = parentRef.current
    if (!el) {
      return
    }
    setScrollState({ scrollTop: el.scrollTop, clientHeight: el.clientHeight })
    const onScroll = () => {
      setScrollState({ scrollTop: el.scrollTop, clientHeight: el.clientHeight })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
    }
  }, [parentRef])

  const { scrollTop, clientHeight } = scrollState
  const totalSize = count * rowHeight
  const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const endIdx = Math.min(
    count,
    Math.ceil((scrollTop + clientHeight) / rowHeight) + overscan,
  )

  const items = []
  for (let i = startIdx; i < endIdx; i++) {
    items.push({ index: i, start: i * rowHeight })
  }

  return { items, totalSize }
}

function defaultSort(a: Entry, b: Entry, col: GenomeColumn) {
  if (col.sortFn) {
    return col.sortFn(a, b)
  }
  const aVal = `${a[col.id] ?? ''}`
  const bVal = `${b[col.id] ?? ''}`
  return aVal.localeCompare(bVal)
}

function defaultColWidth(col: GenomeColumn) {
  if (col.id === 'favorite') {
    return 70
  }
  if (
    col.id === 'name' ||
    col.id === 'commonName' ||
    col.id === 'description'
  ) {
    return 300
  }
  return 150
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showOnlyFavs, setShowOnlyFavs] = useState(false)
  const [filterOption, setFilterOption] = useState('all')
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false)
  const [multipleSelection, setMultipleSelection] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sorting, setSorting] = useState<{
    id: string
    desc: boolean
  }>()
  const [typeOption, setTypeOption] = useLocalStorage(
    'startScreen-genArkChoice',
    'ucsc',
  )
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
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

  const onResizeStart = (colId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth =
      colWidths[colId] ?? defaultColWidth(columns.find(c => c.id === colId)!)

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + ev.clientX - startX)
      setColWidths(prev => ({ ...prev, [colId]: newWidth }))
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const parentRef = useRef<HTMLDivElement>(null)
  const { items: virtualItems, totalSize } = useVirtualRows(
    parentRef,
    sortedData.length,
    ROW_HEIGHT,
  )

  const lastColId = columns.at(-1)?.id

  const allSelected =
    sortedData.length > 0 && sortedData.every(row => selected.has(row.id))

  const someSelected =
    !allSelected && sortedData.some(row => selected.has(row.id))

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
          <div ref={parentRef} className={classes.root}>
            <table className={classes.table}>
              <colgroup>
                {multipleSelection ? (
                  <col style={{ width: CHECKBOX_WIDTH }} />
                ) : null}
                {columns.map(col => (
                  <col
                    key={col.id}
                    style={{
                      width: colWidths[col.id] ?? defaultColWidth(col),
                    }}
                  />
                ))}
                <col />
              </colgroup>
              <thead className={classes.thead}>
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
                            setSelected(new Set(sortedData.map(r => r.id)))
                          }
                        }}
                        sx={checkboxSx}
                      />
                    </th>
                  ) : null}
                  {columns.map(col => (
                    <th
                      key={col.id}
                      className={classes.headerCell}
                      onClick={() => {
                        toggleSort(col.id)
                      }}
                    >
                      {col.header}
                      {sorting?.id === col.id
                        ? sorting.desc
                          ? ' ↓'
                          : ' ↑'
                        : ''}
                      {col.id !== lastColId ? (
                        <div
                          className={classes.resizeHandle}
                          onMouseDown={e => {
                            onResizeStart(col.id, e)
                          }}
                          onClick={e => {
                            e.stopPropagation()
                          }}
                        >
                          <div className={classes.resizeLine} />
                        </div>
                      ) : null}
                    </th>
                  ))}
                  <th className={classes.fillerCell} />
                </tr>
              </thead>
              <tbody>
                {virtualItems.length > 0 ? (
                  <tr style={{ height: virtualItems[0]!.start }}>
                    <td />
                  </tr>
                ) : null}
                {virtualItems.map(virtualRow => {
                  const row = sortedData[virtualRow.index]!
                  const isSelected = selected.has(row.id)
                  return (
                    <tr
                      key={row.id}
                      className={
                        isSelected
                          ? `${classes.bodyRow} ${classes.selectedRow}`
                          : classes.bodyRow
                      }
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
                        <td key={col.id} className={classes.bodyCell}>
                          {col.cell ? col.cell(row) : `${row[col.id] ?? ''}`}
                        </td>
                      ))}
                      <td className={classes.fillerCell} />
                    </tr>
                  )
                })}
                {virtualItems.length > 0 ? (
                  <tr
                    style={{
                      height:
                        totalSize - virtualItems.at(-1)!.start - ROW_HEIGHT,
                    }}
                  >
                    <td />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <TablePagination
            pageIndex={0}
            pageSize={sortedData.length}
            totalRows={sortedData.length}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
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
