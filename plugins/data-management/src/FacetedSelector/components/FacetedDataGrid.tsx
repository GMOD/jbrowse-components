import { useRef, useState, useTransition } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import Checkbox from '@mui/material/Checkbox'
import { alpha, darken, lighten } from '@mui/material/styles'
import { observer } from 'mobx-react'

import { useVirtualRows } from './useVirtualRows.ts'
import { useSearchHighlight } from '../../shared/useSearchHighlight.ts'
import { setTracksSelected } from '../facetedSelection.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel, FacetedRow } from '../facetedModel.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const ROW_HEIGHT = 25
const HEADER_HEIGHT = 35
const CHECKBOX_WIDTH = 48

export interface FacetedColumn {
  id: string
  header: string
  cell: (row: FacetedRow) => React.ReactNode
}

const useStyles = makeStyles()(theme => {
  const borderColor =
    theme.palette.mode === 'light'
      ? lighten(alpha(theme.palette.divider, 1), 0.88)
      : darken(alpha(theme.palette.divider, 1), 0.68)
  const border = `1px solid ${borderColor}`
  return {
    root: {
      height: '100%',
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
      lineHeight: `${HEADER_HEIGHT}px`,
      verticalAlign: 'middle',
      boxSizing: 'border-box',
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
    emptyCell: {
      padding: 20,
      textAlign: 'center',
      color: theme.palette.text.secondary,
    },
  }
})

const checkboxSx = {
  padding: 0,
  '& .MuiSvgIcon-root': { fontSize: '1.15rem' },
}

const FacetedDataGrid = observer(function FacetedDataGrid({
  model,
  faceted,
  columns,
  shownTrackIds,
  selection,
}: {
  model: HierarchicalTrackSelectorModel
  faceted: FacetedModel
  columns: FacetedColumn[]
  shownTrackIds: Set<string>
  selection: AnyConfigurationModel[]
}) {
  const { classes } = useStyles()
  const { useShoppingCart, filteredRows, visible, filterText, initialWidths } =
    faceted

  const [, startTransition] = useTransition()

  const selectedIds = useShoppingCart
    ? new Set(selection.map(s => `${s.trackId}`))
    : shownTrackIds

  const visibleColumns = columns.filter(col => visible[col.id] !== false)

  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const colWidths = { ...initialWidths, ...overrides }

  const onResizeStart = (colId: string, e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = colWidths[colId] ?? 100

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + ev.clientX - startX)
      setOverrides(prev => ({ ...prev, [colId]: newWidth }))
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const allSelected =
    filteredRows.length > 0 &&
    filteredRows.every(row => selectedIds.has(row.id))

  const someSelected =
    !allSelected && filteredRows.some(row => selectedIds.has(row.id))

  const handleSelectAll = () => {
    startTransition(() => {
      // allSelected implies every filtered row is selected, so deselect all;
      // otherwise select the rows that aren't yet selected
      const ids = allSelected
        ? filteredRows.map(row => row.id)
        : filteredRows
            .filter(row => !selectedIds.has(row.id))
            .map(row => row.id)
      setTracksSelected(model, ids, !allSelected, useShoppingCart)
    })
  }

  const handleRowToggle = (rowId: string) => {
    startTransition(() => {
      setTracksSelected(
        model,
        [rowId],
        !selectedIds.has(rowId),
        useShoppingCart,
      )
    })
  }

  const lastColId = visibleColumns.at(-1)?.id

  const parentRef = useRef<HTMLDivElement>(null)
  useSearchHighlight(parentRef, filterText, 'jbrowse-faceted-search')
  const { items: virtualItems, totalSize } = useVirtualRows(
    parentRef,
    filteredRows.length,
    ROW_HEIGHT,
  )

  return (
    <div ref={parentRef} className={classes.root}>
      <table className={classes.table}>
        <colgroup>
          <col style={{ width: CHECKBOX_WIDTH }} />
          {visibleColumns.map(col => (
            <col key={col.id} style={{ width: colWidths[col.id] ?? 100 }} />
          ))}
          <col />
        </colgroup>
        <thead className={classes.thead}>
          <tr>
            <th className={classes.checkboxCell}>
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={handleSelectAll}
                slotProps={{ input: { 'aria-label': 'Select all tracks' } }}
                sx={checkboxSx}
              />
            </th>
            {visibleColumns.map(col => (
              <th key={col.id} scope="col" className={classes.headerCell}>
                {col.header}
                {col.id !== lastColId ? (
                  <div
                    className={classes.resizeHandle}
                    onMouseDown={e => {
                      onResizeStart(col.id, e)
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
            const row = filteredRows[virtualRow.index]!
            const isSelected = selectedIds.has(row.id)
            return (
              <tr
                key={row.id}
                className={
                  isSelected
                    ? `${classes.bodyRow} ${classes.selectedRow}`
                    : classes.bodyRow
                }
              >
                <td className={classes.checkboxCell}>
                  <Checkbox
                    size="small"
                    checked={isSelected}
                    onChange={() => {
                      handleRowToggle(row.id)
                    }}
                    slotProps={{
                      input: { 'aria-label': `Select ${row.name}` },
                    }}
                    sx={checkboxSx}
                  />
                </td>
                {visibleColumns.map(col => (
                  <td key={col.id} className={classes.bodyCell}>
                    {col.cell(row)}
                  </td>
                ))}
                <td className={classes.fillerCell} />
              </tr>
            )
          })}
          {virtualItems.length > 0 ? (
            <tr
              style={{
                height: totalSize - virtualItems.at(-1)!.start - ROW_HEIGHT,
              }}
            >
              <td />
            </tr>
          ) : null}
          {filteredRows.length === 0 ? (
            <tr>
              <td
                colSpan={visibleColumns.length + 2}
                className={classes.emptyCell}
              >
                No tracks match the current search and filters
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
})

export default FacetedDataGrid
