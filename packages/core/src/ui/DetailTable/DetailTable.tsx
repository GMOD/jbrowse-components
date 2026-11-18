import { useMemo, useState } from 'react'

import { observer } from 'mobx-react'

import { measureGridWidth } from '../../util/dataGridUtils.ts'
import {
  compareValues,
  searchHighlightPatterns,
  splitSearchWords,
} from '../../util/tableText.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import VirtualTable from '../VirtualTable/VirtualTable.tsx'
import DetailTableToolbar from './DetailTableToolbar.tsx'
import { columnText } from './detailColumns.ts'

import type {
  VirtualTableColumn,
  VirtualTableLeading,
} from '../VirtualTable/VirtualTable.tsx'
import type { DetailTableColumn } from './detailColumns.ts'

const HEADER_PADDING = 46

const useStyles = makeStyles()(theme => ({
  root: {
    marginBottom: theme.spacing(2),
  },
  tableBox: {
    display: 'flex',
    flexDirection: 'column',
  },
}))

function measureColumn<R>(rows: readonly R[], col: DetailTableColumn<R>) {
  return Math.max(
    measureGridWidth(rows.map(columnText(col))),
    measureGridWidth([col.header ?? col.field], { padding: HEADER_PADDING }),
  )
}

/**
 * A feature-details table: as tall as its rows up to `maxHeight`, then
 * scrolling, with header clicks sorting it and a quiet search and CSV export
 * above it
 */
const DetailTable = observer(function DetailTable<
  R extends { id: string | number },
>({
  rows,
  columns,
  title,
  exportName,
  maxHeight = 400,
  leading,
  isRowSelected,
  onRowClick,
  testId,
}: {
  rows: readonly R[]
  columns: DetailTableColumn<R>[]
  /** drawn at the start of the toolbar row */
  title?: React.ReactNode
  /** the exported file's name, without `.csv` */
  exportName: string
  maxHeight?: number
  leading?: VirtualTableLeading<R>
  isRowSelected?: (row: R) => boolean
  onRowClick?: (row: R) => void
  testId?: string
}) {
  const { classes } = useStyles()
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('')
  const [sortAscending, setSortAscending] = useState(true)

  const widths = useMemo(
    () =>
      Object.fromEntries(
        columns.map(col => [col.field, measureColumn(rows, col)]),
      ),
    [rows, columns],
  )
  const searchTexts = useMemo(() => {
    const texts = columns.map(columnText)
    return rows.map(row =>
      texts
        .map(text => text(row))
        .join('\u0000')
        .toLowerCase(),
    )
  }, [rows, columns])
  const words = useMemo(() => splitSearchWords(searchText), [searchText])
  const shownRows = useMemo(() => {
    const searched = words.length
      ? rows.filter((_, i) =>
          words.every(word => searchTexts[i]!.includes(word)),
        )
      : rows
    const sortColumn = columns.find(col => col.field === sortField)
    const direction = sortAscending ? 1 : -1
    return sortColumn
      ? searched
          .map(row => ({ row, key: sortColumn.value(row) }))
          .sort((a, b) => compareValues(a.key, b.key, direction))
          .map(({ row }) => row)
      : searched
  }, [rows, columns, searchTexts, words, sortField, sortAscending])

  return (
    <div className={classes.root} data-testid={testId}>
      <DetailTableToolbar
        title={title}
        rows={shownRows}
        columns={columns}
        total={rows.length}
        searchText={searchText}
        onSearch={setSearchText}
        exportName={exportName}
      />
      <div className={classes.tableBox} style={{ maxHeight }}>
        <VirtualTable
          rows={shownRows}
          columns={columns.map((col, i): VirtualTableColumn<R> => {
            const text = columnText(col)
            return {
              id: col.field,
              header: col.header ?? col.field,
              headerTitle: col.description,
              fill: i === columns.length - 1,
              title: text,
              cell: col.cell ?? text,
            }
          })}
          widths={() => widths}
          leading={leading}
          isRowSelected={isRowSelected}
          onRowClick={onRowClick}
          sortField={sortField}
          sortAscending={sortAscending}
          onSort={(field, ascending) => {
            setSortField(field)
            setSortAscending(ascending)
          }}
          resetKey={JSON.stringify([searchText, sortField, sortAscending])}
          highlightPatterns={searchHighlightPatterns(words)}
          emptyMessage={rows.length ? 'No rows match the search' : 'No rows'}
        />
      </div>
    </div>
  )
})

export default DetailTable
