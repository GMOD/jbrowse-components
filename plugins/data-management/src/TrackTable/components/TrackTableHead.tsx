import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import Checkbox from '@mui/material/Checkbox'
import { observer } from 'mobx-react'

import { checkboxSx, useTableStyles } from './tableStyles.ts'

import type { TableColumn } from './TrackTableGrid.tsx'
import type { MenuItem } from '@jbrowse/core/ui'

const TrackTableHead = observer(function TrackTableHead({
  columns,
  menuItems,
  allSelected,
  someSelected,
  onSelectAll,
  onResizeStart,
  sortField,
  sortAscending,
  onSort,
}: {
  columns: TableColumn[]
  menuItems: () => MenuItem[]
  allSelected: boolean
  someSelected: boolean
  onSelectAll?: () => void
  onResizeStart: (colId: string, e: React.MouseEvent<HTMLElement>) => void
  sortField: string
  sortAscending: boolean
  onSort: (colId: string) => void
}) {
  const { classes } = useTableStyles()
  return (
    <thead className={classes.thead}>
      <tr>
        <th className={classes.checkboxCell}>
          {onSelectAll ? (
            <Checkbox
              size="small"
              checked={allSelected}
              indeterminate={someSelected}
              onChange={() => {
                onSelectAll()
              }}
              slotProps={{ input: { 'aria-label': 'Select all tracks' } }}
              sx={checkboxSx}
            />
          ) : null}
        </th>
        {columns.map(col => {
          const sorted = sortField === col.id
          return (
            <th
              key={col.id}
              scope="col"
              className={classes.headerCell}
              title={col.header}
              aria-sort={
                sorted
                  ? sortAscending
                    ? 'ascending'
                    : 'descending'
                  : undefined
              }
            >
              <button
                type="button"
                className={classes.sortButton}
                onClick={() => {
                  onSort(col.id)
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
        <th className={classes.menuCell}>
          <CascadingMenuButton
            data-testid="track-table-menu"
            tooltip="Table options"
            size="small"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            menuItems={menuItems}
          >
            <ViewColumnIcon fontSize="small" />
          </CascadingMenuButton>
        </th>
      </tr>
    </thead>
  )
})

export default TrackTableHead
