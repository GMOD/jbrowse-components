import React from 'react'
import { observer } from 'mobx-react'
// material ui
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import CloseIcon from '@material-ui/icons/Close'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import { Typography } from '@material-ui/core'
import DialogTitle from '@material-ui/core/DialogTitle'
import Divider from '@material-ui/core/Divider'
import IconButton from '@material-ui/core/IconButton'
import GetAppIcon from '@material-ui/icons/GetApp';
import TextField from '@material-ui/core/TextField'
// core
import { getSession } from '@jbrowse/core/util'
// other
import copy from 'copy-to-clipboard'
import { LinearGenomeViewModel } from '..'


const useStyles = makeStyles(theme => ({
  loadingMessage: {
    padding: theme.spacing(5),
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  dialogContent: {
    width: '100%',
  }
}))

  
function SequenceDialog({
    model,
    handleClose
}: {
    model: LinearGenomeViewModel,
    handleClose: () => void
  }) {
  const classes = useStyles()
  const session = getSession(model)
  const loading = model.selectedSequence === undefined // when fetching for the specific region
  const error = false // add error thrown by the get sequence
  console.log(model)

    return (
      <>
        <Dialog
          maxWidth="xl"
          open
          onClose={handleClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            Get Sequence
            {handleClose ? (
              <IconButton className={classes.closeButton} onClick={() => {
                handleClose()
                model.showSeqDialog(false)
                model.setSelectedSeqRegion(undefined)
              }}>
                <CloseIcon />
              </IconButton>
            ) : null}
          </DialogTitle>
          <Divider />

          <>
            <DialogContent>
            {error ? (<Typography color="error">
                    Failed to retrieve sequence: {`${error}`}
                  </Typography>) : loading ? (
                  <Typography>Retrieving Sequence...</Typography>
                )  :
                (<TextField
                  data-testid="rubberband-sequence"
                  variant="outlined"
                  multiline
                  rows={3}
                  rowsMax={4}
                  className={classes.dialogContent}
                  fullWidth
                  value={'sequence preview'}
                  InputProps={{
                    readOnly: true,
                  }}
                  />)}
              
              </DialogContent> 
          </>
          <DialogActions>
            <Button
              onClick={() => {
                copy("hello, this is where the sequence will go")
                session.notify('Copied to clipboard', 'success')
              }}
              disabled={loading}
              color="primary"
              startIcon={<ContentCopyIcon />}
            >
              Copy Sequence to Clipboard
            </Button>
            <Button
              onClick={() => console.log("download fasta file")}
              disabled={loading}
              color="primary"
              startIcon={<GetAppIcon />}
            >
              Download FASTA file
            </Button>
          </DialogActions>
        </Dialog>
      </>
    )
}
  
export default observer(SequenceDialog)
