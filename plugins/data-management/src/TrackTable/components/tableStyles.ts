import { ROW_HEIGHT } from '@jbrowse/core/ui/VirtualTable'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { trackRowTints } from '../../HierarchicalTrackSelectorWidget/components/tree/trackRowTints.ts'

const CHECKBOX_ICON_SIZE = '1.15rem'

export const useTableStyles = makeStyles()(theme => ({
  trackRow: {
    '&:hover > td': {
      background: trackRowTints(theme).hover,
    },
  },
  selectedTrackRow: {
    background: trackRowTints(theme).selected,
  },
  rowCheckbox: {
    width: '100%',
    height: ROW_HEIGHT - 1,
    '& svg': { width: CHECKBOX_ICON_SIZE, height: CHECKBOX_ICON_SIZE },
  },
  valueCell: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
