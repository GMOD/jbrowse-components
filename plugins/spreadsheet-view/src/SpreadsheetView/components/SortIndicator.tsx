import React from 'react'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { makeStyles } from 'tss-react/mui'

// icons
import type { SpreadsheetModel } from '../models/Spreadsheet'

const useStyles = makeStyles()({
  sortIndicator: {
    position: 'relative',
    top: '0.2rem',
    fontSize: '1rem',
  },
})

export default function SortIndicator({
  model,
  columnNumber,
}: {
  model: SpreadsheetModel
  columnNumber: number
}) {
  const { classes } = useStyles()
  const sortSpec = model.sortColumns.find(c => c.columnNumber === columnNumber)

  if (sortSpec) {
    const { descending } = sortSpec
    return descending ? (
      <KeyboardArrowUpIcon className={classes.sortIndicator} />
    ) : (
      <KeyboardArrowDownIcon className={classes.sortIndicator} />
    )
  }
  return null
}
