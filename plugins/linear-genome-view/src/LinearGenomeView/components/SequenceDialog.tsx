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
import { saveAs } from 'file-saver'
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
          data-testid="sequence-dialog"
          maxWidth="xl"
          open
          onClose={handleClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            Get Sequence
            {handleClose ? (
              <IconButton data-testid="close-seqDialog" className={classes.closeButton} onClick={() => {
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
                  value={model.selectedSequence}
                  InputProps={{
                    readOnly: true,
                  }}
                  />)}
              
              </DialogContent> 
          </>
          <DialogActions>
            <Button
              onClick={() => {
                copy(model?.selectedSequence || '')
                session.notify('Copied to clipboard', 'success')
              }}
              disabled={loading}
              color="primary"
              startIcon={<ContentCopyIcon />}
            >
              Copy Sequence to Clipboard
            </Button>
            <Button
              onClick={() => {
                const selectedSeq = new Blob(
                  ['>TestingDownload abcdefg'],
                  { type: 'text/x-fasta;charset=utf-8' },
                )
                saveAs(selectedSeq, 'selected-seq.fa')
              }}
              disabled={loading}
              color="primary"
              startIcon={<GetAppIcon />}
            >
              Download FASTA file
            </Button>
            <Button onClick={() => {
                handleClose()
                model.showSeqDialog(false)
                model.setSelectedSeqRegion(undefined)
              }} 
              color="primary" autoFocus>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </>
    )
}
  
export default observer(SequenceDialog)
