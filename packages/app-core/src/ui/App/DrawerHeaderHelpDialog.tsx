import InfoDialog from '@jbrowse/core/ui/InfoDialog'
import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  max: {
    minWidth: '40em',
  },
})

export default function DrawerHeaderHelpDialog({
  onClose,
  helpText,
}: {
  onClose: () => void
  helpText: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <InfoDialog
      open
      onClose={onClose}
      title="Help"
      maxWidth="xl"
      onClick={e => {
        e.stopPropagation()
      }}
    >
      <div className={classes.max}>{helpText}</div>
    </InfoDialog>
  )
}
