import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  root: {
    width: '30em',
  },
  section: {
    marginBottom: theme.spacing(1),
  },
  label: {
    fontWeight: 'bold',
  },
}))

function getTypeLabel(type: string) {
  switch (type) {
    case 'insertion':
      return 'Insertion'
    case 'softclip':
      return 'Soft clip'
    case 'hardclip':
      return 'Hard clip'
    default:
      return type
  }
}

const InterbaseInfoDialog = observer(function ({
  item,
  handleClose,
}: {
  item: {
    type: string
    base: string
    count: number
    total: number
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { count, total } = item
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0
  return (
    <Dialog open maxWidth="sm" onClose={handleClose} title="Interbase indicator">
      <DialogContent className={classes.root}>
        <div className={classes.section}>
          <Typography className={classes.label}>Type:</Typography>
          <Typography>{getTypeLabel(item.type)}</Typography>
        </div>
        <div className={classes.section}>
          <Typography className={classes.label}>Count:</Typography>
          <Typography>
            {count}/{total} ({pct}%)
          </Typography>
        </div>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            onClick={handleClose}
            autoFocus
          >
            Close
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
})

export default InterbaseInfoDialog
