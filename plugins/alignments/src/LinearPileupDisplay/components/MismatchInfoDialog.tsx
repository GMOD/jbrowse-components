import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'


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
    type: string
    seq: string
    modType?: string
    probability?: number
  }
  featureId?: string
  handleClose: () => void
}) {
  const { classes } = useStyles()
  return (
    <Dialog
      open
      maxWidth="lg"
      onClose={handleClose}
      title={`Info: ${item.type}`}
    >
      <DialogContent className={classes.root}>
        {item.type === 'insertion' && (
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

        {item.type === 'deletion' && <LengthDisplay length={item.seq} />}

        {item.type === 'modification' && (
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

        {item.type === 'mismatch' && (
          <div className={classes.section}>
            <Typography className={classes.label}>Base:</Typography>
            <Typography>{item.seq}</Typography>
          </div>
        )}

        {item.type === 'softclip' && <LengthDisplay length={item.seq} />}

        {item.type === 'hardclip' && <LengthDisplay length={item.seq} />}

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
