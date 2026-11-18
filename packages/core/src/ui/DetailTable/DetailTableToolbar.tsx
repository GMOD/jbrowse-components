import GetAppIcon from '@mui/icons-material/GetApp'
import { IconButton, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { saveAs } from '../../util/FileSaver/index.ts'
import { csvText } from '../../util/tableText.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import { SearchField } from '../ClearableSearchField.tsx'
import ControlRow from '../ControlRow.tsx'
import { columnText } from './detailColumns.ts'

import type { DetailTableColumn } from './detailColumns.ts'

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

function tableCsv<R>(rows: readonly R[], columns: DetailTableColumn<R>[]) {
  const texts = columns.map(columnText)
  return csvText(
    columns.map(col => col.header ?? col.field),
    rows.map(row => texts.map(text => text(row))),
  )
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
      {rows.length === total ? null : (
        <Typography
          variant="caption"
          color="textSecondary"
          noWrap
          role="status"
        >
          {rows.length} of {total}
        </Typography>
      )}
      <SearchField
        quiet
        size="small"
        className={classes.search}
        label="Search"
        value={searchText}
        onChange={onSearch}
      />
      <Tooltip title="Export these rows as CSV">
        <IconButton
          size="small"
          aria-label="Export CSV"
          onClick={() => {
            saveAs(
              new Blob([tableCsv(rows, columns)], {
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
