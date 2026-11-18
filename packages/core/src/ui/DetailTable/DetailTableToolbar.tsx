import GetAppIcon from '@mui/icons-material/GetApp'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { saveAs } from '../../util/FileSaver/index.ts'
import { cellText, csvLine } from '../../util/tableText.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import { SearchField } from '../ClearableSearchField.tsx'
import ControlRow from '../ControlRow.tsx'

import type { DetailTableColumn } from './DetailTable.tsx'

const useStyles = makeStyles()(theme => ({
  row: {
    marginBottom: theme.spacing(0.5),
  },
  title: {
    minWidth: 0,
    flex: 1,
  },
  search: {
    width: 140,
    '& input': {
      fontSize: theme.typography.body2.fontSize,
    },
  },
}))

function csvText<R>(rows: readonly R[], columns: DetailTableColumn<R>[]) {
  return [
    csvLine(columns.map(col => col.header ?? col.field)),
    ...rows.map(row => csvLine(columns.map(col => cellText(col.value(row))))),
  ].join('\r\n')
}

const DetailTableToolbar = observer(function DetailTableToolbar<R>({
  title,
  rows,
  columns,
  total,
  searchText,
  onSearch,
  exportName,
}: {
  title: React.ReactNode
  rows: readonly R[]
  columns: DetailTableColumn<R>[]
  total: number
  searchText: string
  onSearch: (text: string) => void
  exportName: string
}) {
  const { classes } = useStyles()
  return (
    <ControlRow className={classes.row}>
      <div className={classes.title}>{title}</div>
      <SearchField
        quiet
        size="small"
        className={classes.search}
        label="Search"
        value={searchText}
        status={
          rows.length === total ? undefined : `${rows.length} of ${total}`
        }
        onChange={onSearch}
      />
      <Tooltip title="Export these rows as CSV">
        <IconButton
          size="small"
          aria-label="Export CSV"
          onClick={() => {
            saveAs(
              new Blob([csvText(rows, columns)], {
                type: 'text/csv;charset=utf-8',
              }),
              `${exportName}.csv`,
            )
          }}
        >
          <GetAppIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </ControlRow>
  )
})

export default DetailTableToolbar
