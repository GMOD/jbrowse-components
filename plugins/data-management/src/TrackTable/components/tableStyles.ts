import { makeStyles } from '@jbrowse/core/util/tss-react'

const CHECKBOX_ICON_SIZE = '1.15rem'

export const useTableStyles = makeStyles()({
  rowCheckbox: {
    '& svg': { width: CHECKBOX_ICON_SIZE, height: CHECKBOX_ICON_SIZE },
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
    '& > :not(:first-child)': {
      flexShrink: 0,
    },
  },
})
