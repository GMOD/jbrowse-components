import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'

import { notEmpty } from '@jbrowse/core/util'
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
const BORDER_COLOR = '#e0e0e0'

export interface FacetedColumn {
  id: string
  header: string
  cell: (row: FacetedRow) => React.ReactNode
}

function useColumnResize(
  initialWidths: Record<string, number>,
  deps: unknown[],
) {
  const [widths, setWidths] = useState(initialWidths)

  useEffect(() => {
    setWidths(prev => ({ ...initialWidths, ...prev }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const resizeRef = useRef<{
    colId: string
    startX: number
    startWidth: number
  } | null>(null)

  const onResizeStart = useCallback(
    (colId: string, e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = widths[colId] ?? 100

      resizeRef.current = { colId, startX, startWidth }

      const onMouseMove = (ev: MouseEvent) => {
        if (resizeRef.current) {
          const { colId: id, startX: sx, startWidth: sw } = resizeRef.current
          const newWidth = Math.max(50, sw + ev.clientX - sx)
          setWidths(prev => ({ ...prev, [id]: newWidth }))
        }
      }

      const onMouseUp = () => {
        resizeRef.current = null
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [widths],
  )

  return { widths, onResizeStart }
}

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
    () => ({
      __checkbox: CHECKBOX_WIDTH,
      ...computeInitialWidths(
        rows,
        filteredNonMetadataKeys,
        filteredMetadataKeys,
        visible,
      ),
    }),
    [rows, filteredNonMetadataKeys, filteredMetadataKeys, visible],
  )

  const { widths: colWidths, onResizeStart } = useColumnResize(
    initialWidths,
    [rows, filteredNonMetadataKeys, filteredMetadataKeys, visible],
  )

  const allSelected = useMemo(
    () =>
      filteredRows.length > 0 &&
      filteredRows.every(row => selectedIds.has(row.id)),
    [filteredRows, selectedIds],
  )
  const someSelected = useMemo(
    () =>
      !allSelected && filteredRows.some(row => selectedIds.has(row.id)),
    [filteredRows, selectedIds, allSelected],
  )

  const handleSelectAll = useCallback(() => {
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
  }, [
    allSelected,
    filteredRows,
    selectedIds,
    useShoppingCart,
    view,
    model,
    selection,
    startTransition,
  ])

  const handleRowToggle = useCallback(
    (rowId: string) => {
      startTransition(() => {
        const wasSelected = selectedIds.has(rowId)
        if (!useShoppingCart) {
          if (wasSelected) {
            view.hideTrack(rowId)
          } else {
            view.showTrack(rowId)
            model.addToRecentlyUsed(rowId)
          }
        } else {
          if (wasSelected) {
            model.setSelection(
              selection.filter(s => `${s.trackId}` !== rowId),
            )
          } else {
            const conf =
              model.allTrackConfigurationTrackIdSet.get(rowId)
            if (conf) {
              model.setSelection([...selection, conf])
            }
          }
        }
      })
    },
    [selectedIds, useShoppingCart, view, model, selection, startTransition],
  )

  const totalWidth = CHECKBOX_WIDTH +
    visibleColumns.reduce(
      (sum, col) => sum + (colWidths[col.id] ?? 100),
      0,
    )

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
    <div
      ref={parentRef}
      style={{
        height: '100%',
        width: '100%',
        overflow: 'auto',
        border: `1px solid ${BORDER_COLOR}`,
        borderRadius: 4,
        background: '#fff',
      }}
    >
      <table
        style={{
          minWidth: '100%',
          width: totalWidth,
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <colgroup>
          <col style={{ width: CHECKBOX_WIDTH }} />
          {visibleColumns.map(col => (
            <col key={col.id} style={{ width: colWidths[col.id] ?? 100 }} />
          ))}
        </colgroup>
        <thead
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            background: '#fff',
          }}
        >
          <tr>
            <th
              style={{
                height: HEADER_HEIGHT,
                textAlign: 'center',
                verticalAlign: 'middle',
                lineHeight: 0,
                padding: 0,
                borderBottom: `1px solid ${BORDER_COLOR}`,
                boxSizing: 'border-box',
              }}
            >
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={handleSelectAll}
                sx={checkboxSx}
              />
            </th>
            {visibleColumns.map(col => {
              const isLast = col.id === lastColId
              return (
                <th
                  key={col.id}
                  style={{
                    height: HEADER_HEIGHT,
                    position: 'relative',
                    textAlign: 'left',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    padding: '0 10px',
                    borderBottom: `1px solid ${BORDER_COLOR}`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    lineHeight: `${HEADER_HEIGHT}px`,
                    verticalAlign: 'middle',
                    boxSizing: 'border-box',
                  }}
                >
                  {col.header}
                  {!isLast ? (
                    <div
                      onMouseDown={e => onResizeStart(col.id, e)}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '25%',
                        height: '50%',
                        width: 10,
                        display: 'flex',
                        justifyContent: 'center',
                        cursor: 'col-resize',
                      }}
                    >
                      <div
                        style={{
                          width: 1,
                          height: '100%',
                          background: BORDER_COLOR,
                        }}
                      />
                    </div>
                  ) : null}
                </th>
              )
            })}
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
              <tr key={row.id} style={{ height: ROW_HEIGHT }}>
                <td
                  style={{
                    height: ROW_HEIGHT,
                    padding: 0,
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    lineHeight: 0,
                    borderBottom: `1px solid ${BORDER_COLOR}`,
                    boxSizing: 'border-box',
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={isSelected}
                    onChange={() => handleRowToggle(row.id)}
                    sx={checkboxSx}
                  />
                </td>
                {visibleColumns.map(col => (
                  <td
                    key={col.id}
                    style={{
                      height: ROW_HEIGHT,
                      padding: '0 10px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '0.8125rem',
                      borderBottom: `1px solid ${BORDER_COLOR}`,
                      lineHeight: `${ROW_HEIGHT - 1}px`,
                      boxSizing: 'border-box',
                    }}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            )
          })}
          {virtualItems.length > 0 ? (
            <tr
              style={{
                height:
                  virtualizer.getTotalSize() - (virtualItems.at(-1)!.end),
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
