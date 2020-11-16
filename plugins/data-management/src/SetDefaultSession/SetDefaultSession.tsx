import React from 'react'
import { observer } from 'mobx-react'
import Dialog from '@material-ui/core/Dialog'
import { makeStyles } from '@material-ui/core/styles'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogContent from '@material-ui/core/DialogContent'
import DialogActions from '@material-ui/core/DialogActions'
import Button from '@material-ui/core/Button'

const useStyles = makeStyles(theme => ({
  titleBox: {
    color: '#fff',
    backgroundColor: theme.palette.primary.main,
    textAlign: 'center',
  },
  dialogContent: {
    width: 600,
  },
  backButton: {
    color: '#fff',
    position: 'absolute',
    left: theme.spacing(4),
    top: theme.spacing(4),
  },
}))

const SetDefaultSession = observer(
  ({ open, onClose }: { open: boolean; onClose: Function }) => {
    const classes = useStyles()

    return (
      <Dialog open={open}>
        <DialogTitle className={classes.titleBox}>
          Set Default Session
        </DialogTitle>
        <DialogContent>Looooots of Content</DialogContent>
        <DialogActions>
          <Button
            color="secondary"
            variant="contained"
            onClick={() => {
              onClose(false)
            }}
          >
            Return
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

export default SetDefaultSession
