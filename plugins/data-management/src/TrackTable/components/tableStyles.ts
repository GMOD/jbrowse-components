import { ROW_HEIGHT } from '@jbrowse/core/ui/VirtualTable'
import { makeStyles } from '@jbrowse/core/util/tss-react'

const CHECKBOX_ICON_SIZE = '1.15rem'

export const useTableStyles = makeStyles()(theme => ({
  grid: {
    height: '100%',
    '& tbody tr:has(input[type="checkbox"]):hover > td': {
      background: theme.palette.action.hover,
    },
  },
  rowCheckbox: {
    width: '100%',
    height: ROW_HEIGHT - 1,
    '& svg': { width: CHECKBOX_ICON_SIZE, height: CHECKBOX_ICON_SIZE },
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
    cursor: 'pointer',
    '& > :not(:first-child)': {
      flexShrink: 0,
    },
  },
}))
