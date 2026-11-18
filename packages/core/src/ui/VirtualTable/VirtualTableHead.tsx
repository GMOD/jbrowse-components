import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import { observer } from 'mobx-react'

import { cx } from '../../util/tss-react/index.ts'
import { useVirtualTableStyles } from './tableStyles.ts'

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
  onResizeStart,
  sortField,
  sortAscending,
  onSort,
}: {
  columns: VirtualTableColumn<R>[]
  leadingHeader: React.ReactNode
  hasLeading: boolean
  onResizeStart: (colId: string, e: React.MouseEvent<HTMLElement>) => void
  sortField: string
  sortAscending: boolean
  onSort: (field: string, ascending: boolean) => void
}) {
  const { classes } = useVirtualTableStyles()
  return (
    <thead className={classes.thead}>
      <tr>
        {hasLeading ? (
          <th className={classes.leadingCell}>{leadingHeader}</th>
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
              <div
                className={classes.resizeHandle}
                onMouseDown={e => {
                  onResizeStart(col.id, e)
                }}
              >
                <div className={classes.resizeLine} />
              </div>
            </th>
          )
        })}
      </tr>
    </thead>
  )
})

export default VirtualTableHead
