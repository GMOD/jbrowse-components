/* eslint-disable tss-unused-classes/unused-classes */
import { makeStyles } from '@jbrowse/core/util/tss-react'

export const monospaceFontFamily =
  'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace'

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
}))
