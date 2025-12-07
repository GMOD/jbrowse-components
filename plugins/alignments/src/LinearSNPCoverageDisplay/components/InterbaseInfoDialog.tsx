import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import {
  formatInterbaseStats,
  getInterbaseTypeLabel,
} from '../../SNPCoverageRenderer/types'

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

const InterbaseInfoDialog = observer(function ({
  item,
  handleClose,
}: {
  item: {
    type: 'insertion' | 'softclip' | 'hardclip'
    base: string
    count: number
    total: number
    avgLength?: number
    minLength?: number
    maxLength?: number
    topSequence?: string
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { type, count, total, avgLength, minLength, maxLength, topSequence } =
    item
  return (
    <Dialog
      open
      maxWidth="sm"
      onClose={handleClose}
      title="Interbase indicator"
    >
      <DialogContent className={classes.root}>
        <div className={classes.section}>
          <Typography className={classes.label}>Type:</Typography>
          <Typography>{getInterbaseTypeLabel(type)}</Typography>
        </div>
        <div className={classes.section}>
          <Typography className={classes.label}>Count:</Typography>
          <Typography style={{ whiteSpace: 'pre-wrap' }}>
            {formatInterbaseStats(count, total, type, {
              avgLength,
              minLength,
              maxLength,
              topSequence,
            })}
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
