import { Checkbox } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../../util/tss-react/index.ts'

const useStyles = makeStyles()({
  checkbox: {
    padding: 0,
    '& svg': { width: '1.15rem', height: '1.15rem' },
  },
})

/**
 * a checkbox sized for a table row's leading column, whose click stops short
 * of the row's own
 */
const TableCheckbox = observer(function TableCheckbox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  label: string
  onChange: () => void
}) {
  const { classes } = useStyles()
  return (
    <Checkbox
      size="small"
      className={classes.checkbox}
      checked={checked}
      indeterminate={indeterminate}
      onClick={event => {
        event.stopPropagation()
      }}
      onChange={() => {
        onChange()
      }}
      slotProps={{ input: { 'aria-label': label } }}
    />
  )
})

export default TableCheckbox
