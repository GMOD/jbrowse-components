import React, { useState } from 'react'
import Button from '@material-ui/core/Button'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Divider from '@material-ui/core/Divider'
import WarningIcon from '@material-ui/icons/Warning'

const useStyles = makeStyles(theme => ({
  temp: {
    zIndex: theme.zIndex.tooltip,
  },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SessionWarningModal = observer(
  ({ userInputFunction }: { userInputFunction: (flag: boolean) => void }) => {
    const [open, setOpen] = useState(false)
    const classes = useStyles()
    const handleClose = () => {
      setOpen(false)
    }
    return (
      <Dialog
        maxWidth="xl"
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        data-testid="share-dialog"
        className={classes.temp}
      >
        <DialogTitle id="alert-dialog-title">Warning</DialogTitle>
        <Divider />
        <div>
          <WarningIcon fontSize="large" />
          <DialogContent>
            <DialogContentText>
              About to load a session. Please confirm that you trust the loaded
              file contents.
            </DialogContentText>
          </DialogContent>
          <div>
            <Button
              color="primary"
              variant="contained"
              style={{ marginRight: 5 }}
              onClick={() => {
                userInputFunction(true)
                setOpen(false)
              }}
            >
              Confirm
            </Button>
            <Button
              color="primary"
              variant="contained"
              onClick={() => {
                // @ts-ignore
                userInputFunction(false)
                setOpen(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    )
  },
)

export default SessionWarningModal
