/* eslint-disable tss-unused-classes/unused-classes */
import { makeStyles } from '@jbrowse/core/util/tss-react'

export const useSlotEditorStyles = makeStyles()(theme => ({
  paper: {
    display: 'flex',
    marginBottom: theme.spacing(2),
    position: 'relative',
  },
  paperContent: {
    flex: 1,
    minWidth: 0,
  },
  slotModeSwitch: {
    width: 24,
    background: theme.palette.secondary.light,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButton: {
    display: 'flex',
    alignItems: 'center',
  },
}))
