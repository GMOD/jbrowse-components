import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import {
  MISMATCH_TYPE_DELETION,
  MISMATCH_TYPE_HARDCLIP,
  MISMATCH_TYPE_INSERTION,
  MISMATCH_TYPE_MISMATCH,
  MISMATCH_TYPE_MODIFICATION,
  MISMATCH_TYPE_SOFTCLIP,
} from '../../shared/types'

const MISMATCH_TYPE_NAMES: Record<number, string> = {
  [MISMATCH_TYPE_MISMATCH]: 'mismatch',
  [MISMATCH_TYPE_INSERTION]: 'insertion',
  [MISMATCH_TYPE_DELETION]: 'deletion',
  [MISMATCH_TYPE_SOFTCLIP]: 'softclip',
  [MISMATCH_TYPE_HARDCLIP]: 'hardclip',
  [MISMATCH_TYPE_MODIFICATION]: 'modification',
}

const useStyles = makeStyles()(theme => ({
  root: {
    width: '80em',
  },
  section: {
    marginBottom: theme.spacing(1),
  },
  label: {
    fontWeight: 'bold',
  },

  textAreaFont: {
    fontFamily: 'Courier New',
  },
}))

const LengthDisplay = ({ length }: { length: string }) => {
  const { classes } = useStyles()
  return (
    <div className={classes.section}>
      <Typography className={classes.label}>Length:</Typography>
      <Typography>{length}bp</Typography>
    </div>
  )
}

const MismatchInfoDialog = observer(function ({
  item,
  handleClose,
}: {
  item: {
    type: number
    seq: string
    modType?: string
    probability?: number
  }
  featureId?: string
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const typeName = MISMATCH_TYPE_NAMES[item.type] ?? 'unknown'
  return (
    <Dialog
      open
      maxWidth="lg"
      onClose={handleClose}
      title={`Info: ${typeName}`}
    >
      <DialogContent className={classes.root}>
        {item.type === MISMATCH_TYPE_INSERTION && (
          <div className={classes.section}>
            <Typography className={classes.label}>Sequence:</Typography>
            <TextField
              variant="outlined"
              multiline
              minRows={5}
              maxRows={10}
              fullWidth
              value={item.seq}
              slotProps={{
                input: {
                  readOnly: true,
                  classes: {
                    input: classes.textAreaFont,
                  },
                },
              }}
            />
          </div>
        )}

        {item.type === MISMATCH_TYPE_DELETION && (
          <LengthDisplay length={item.seq} />
        )}

        {item.type === MISMATCH_TYPE_MODIFICATION && (
          <>
            <div className={classes.section}>
              <Typography className={classes.label}>Modification:</Typography>
              <Typography>{item.seq}</Typography>
            </div>
            {item.modType && (
              <div className={classes.section}>
                <Typography className={classes.label}>Type:</Typography>
                <Typography>{item.modType}</Typography>
              </div>
            )}
            {item.probability !== undefined && (
              <div className={classes.section}>
                <Typography className={classes.label}>Probability:</Typography>
                <Typography>{item.probability.toFixed(3)}</Typography>
              </div>
            )}
          </>
        )}

        {item.type === MISMATCH_TYPE_MISMATCH && (
          <div className={classes.section}>
            <Typography className={classes.label}>Base:</Typography>
            <Typography>{item.seq}</Typography>
          </div>
        )}

        {item.type === MISMATCH_TYPE_SOFTCLIP && (
          <LengthDisplay length={item.seq} />
        )}

        {item.type === MISMATCH_TYPE_HARDCLIP && (
          <LengthDisplay length={item.seq} />
        )}

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

export default MismatchInfoDialog
