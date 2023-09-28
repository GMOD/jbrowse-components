import { makeStyles } from 'tss-react/mui'

export const useSlotEditorStyles = makeStyles()(theme => ({
  paper: {
    display: 'flex',
    marginBottom: theme.spacing(2),
    position: 'relative',
  },
  paperContent: {
    width: '100%',
  },
  slotModeSwitch: {
    width: 24,
    background: theme.palette.secondary.light,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
}))
