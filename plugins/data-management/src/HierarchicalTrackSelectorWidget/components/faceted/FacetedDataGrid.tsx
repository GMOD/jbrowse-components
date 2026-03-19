import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import { notEmpty } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import Checkbox from '@mui/material/Checkbox'
import { useVirtualizer } from '@tanstack/react-virtual'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import { computeInitialWidths } from './computeInitialWidths.ts'

import type { FacetedModel, FacetedRow } from '../../facetedModel.ts'
import type { HierarchicalTrackSelectorModel } from '../../model.ts'
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
  const border = `1px solid ${theme.palette.divider}`
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
      background: theme.palette.divider,
    },
    fillerCell: {
      borderBottom: border,
      padding: 0,
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
  const { view } = model
  const {
    rows,
    useShoppingCart,
    filteredRows,
    filteredNonMetadataKeys,
    filteredMetadataKeys,
    visible,
  } = faceted

  const [, startTransition] = useTransition()

  const selectedIds = useMemo(
    () =>
      new Set(
        useShoppingCart
          ? selection.map(s => `${s.trackId}`)
          : [...shownTrackIds],
      ),
    [useShoppingCart, selection, shownTrackIds],
  )

  const visibleColumns = useMemo(
    () => columns.filter(col => visible[col.id] !== false),
    [columns, visible],
  )

  const initialWidths = useMemo(
    () =>
      computeInitialWidths(
        rows,
        filteredNonMetadataKeys,
        filteredMetadataKeys,
        visible,
      ),
    [rows, filteredNonMetadataKeys, filteredMetadataKeys, visible],
  )

  const [colWidths, setColWidths] =
    useState<Record<string, number>>(initialWidths)
  useEffect(() => {
    setColWidths(prev => ({ ...initialWidths, ...prev }))
  }, [initialWidths])

  const onResizeStart = (colId: string, e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = colWidths[colId] ?? 100

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

  const allSelected =
    filteredRows.length > 0 &&
    filteredRows.every(row => selectedIds.has(row.id))

  const someSelected =
    !allSelected && filteredRows.some(row => selectedIds.has(row.id))

  const handleSelectAll = () => {
    startTransition(() => {
      if (!useShoppingCart) {
        transaction(() => {
          if (allSelected) {
            for (const row of filteredRows) {
              if (selectedIds.has(row.id)) {
                view.hideTrack(row.id)
              }
            }
          } else {
            for (const row of filteredRows) {
              if (!selectedIds.has(row.id)) {
                view.showTrack(row.id)
                model.addToRecentlyUsed(row.id)
              }
            }
          }
        })
      } else {
        if (allSelected) {
          const filteredIdSet = new Set(filteredRows.map(r => r.id))
          model.setSelection(
            selection.filter(s => !filteredIdSet.has(`${s.trackId}`)),
          )
        } else {
          const currentIds = new Set(selection.map(s => `${s.trackId}`))
          const toAdd = filteredRows
            .filter(r => !currentIds.has(r.id))
            .map(r => model.allTrackConfigurationTrackIdSet.get(r.id))
            .filter(notEmpty)
          model.setSelection([...selection, ...toAdd])
        }
      }
    })
  }

  const handleRowToggle = (rowId: string) => {
    startTransition(() => {
      if (!useShoppingCart) {
        if (selectedIds.has(rowId)) {
          view.hideTrack(rowId)
        } else {
          view.showTrack(rowId)
          model.addToRecentlyUsed(rowId)
        }
      } else {
        if (selectedIds.has(rowId)) {
          model.setSelection(
            selection.filter(s => `${s.trackId}` !== rowId),
          )
        } else {
          const conf = model.allTrackConfigurationTrackIdSet.get(rowId)
          if (conf) {
            model.setSelection([...selection, conf])
          }
        }
      }
    })
  }

  const lastColId = visibleColumns.at(-1)?.id

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  })

  const virtualItems = virtualizer.getVirtualItems()

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
                sx={checkboxSx}
              />
            </th>
            {visibleColumns.map(col => (
              <th key={col.id} className={classes.headerCell}>
                {col.header}
                {col.id !== lastColId ? (
                  <div
                    className={classes.resizeHandle}
                    onMouseDown={e => onResizeStart(col.id, e)}
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
            return (
              <tr key={row.id}>
                <td className={classes.checkboxCell}>
                  <Checkbox
                    size="small"
                    checked={selectedIds.has(row.id)}
                    onChange={() => handleRowToggle(row.id)}
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
                height:
                  virtualizer.getTotalSize() - virtualItems.at(-1)!.end,
              }}
            >
              <td />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
})

export default FacetedDataGrid
