import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import { observer } from 'mobx-react'

import { cx } from '../../util/tss-react/index.ts'
import ColumnResizeHandle from './ColumnResizeHandle.tsx'
import { DEFAULT_COL_WIDTH, useVirtualTableStyles } from './tableStyles.ts'

import type { VirtualTableColumn } from './VirtualTable.tsx'

function nextSort(field: string, sortField: string, sortAscending: boolean) {
  return sortField !== field
    ? { field, ascending: true }
    : sortAscending
      ? { field, ascending: false }
      : { field: '', ascending: true }
}

const VirtualTableHead = observer(function VirtualTableHead<R>({
  columns,
  leadingHeader,
  hasLeading,
  colWidths,
  onResize,
  onResetWidth,
  sortField,
  sortAscending,
  onSort,
}: {
  columns: VirtualTableColumn<R>[]
  leadingHeader: React.ReactNode
  hasLeading: boolean
  colWidths: Record<string, number>
  onResize: (colId: string, width: number) => void
  onResetWidth: (colId: string) => void
  sortField: string
  sortAscending: boolean
  onSort: (field: string, ascending: boolean) => void
}) {
  const { classes } = useVirtualTableStyles()
  return (
    <thead className={classes.thead}>
      <tr>
        {hasLeading ? (
          <th scope="col" className={classes.leadingCell}>
            {leadingHeader}
          </th>
        ) : null}
        {columns.map(col => {
          const sorted = sortField === col.id
          const headerClass = cx(
            classes.headerContent,
            col.align === 'right' && classes.headerContentRight,
          )
          return (
            <th
              key={col.id}
              scope="col"
              className={classes.headerCell}
              title={col.headerTitle ?? col.header}
              aria-sort={
                sorted
                  ? sortAscending
                    ? 'ascending'
                    : 'descending'
                  : undefined
              }
            >
              {col.sortValue ? (
                <button
                  type="button"
                  className={cx(headerClass, classes.sortButton)}
                  onClick={() => {
                    const next = nextSort(col.id, sortField, sortAscending)
                    onSort(next.field, next.ascending)
                  }}
                >
                  <span className={classes.headerLabel}>{col.header}</span>
                  {sorted ? (
                    sortAscending ? (
                      <ArrowUpwardIcon className={classes.sortIcon} />
                    ) : (
                      <ArrowDownwardIcon className={classes.sortIcon} />
                    )
                  ) : null}
                </button>
              ) : (
                <div className={headerClass}>
                  <span className={classes.headerLabel}>{col.header}</span>
                </div>
              )}
              <ColumnResizeHandle
                width={colWidths[col.id] ?? DEFAULT_COL_WIDTH}
                onResize={width => {
                  onResize(col.id, width)
                }}
                onReset={() => {
                  onResetWidth(col.id)
                }}
              />
            </th>
          )
        })}
      </tr>
    </thead>
  )
})

export default VirtualTableHead
