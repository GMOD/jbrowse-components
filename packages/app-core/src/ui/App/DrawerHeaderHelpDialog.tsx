import Dialog from '@jbrowse/core/ui/Dialog'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DialogContent } from '@mui/material'

const useStyles = makeStyles()({
  max: {
    minWidth: '40em',
  },
})

export default function DrawerHeaderHelpDialog({
  onClose,
  helpText,
}: {
  onClose: (event: React.MouseEvent | React.KeyboardEvent) => void
  helpText: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <Dialog
      open
      onClose={onClose}
      title="Help"
      maxWidth="xl"
      onClick={e => {
        e.stopPropagation()
      }}
    >
      <DialogContent className={classes.max}>{helpText}</DialogContent>
    </Dialog>
  )
}
