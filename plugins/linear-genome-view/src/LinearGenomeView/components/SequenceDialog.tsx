import React from 'react'
import { observer } from 'mobx-react'
import { saveAs } from 'file-saver'
import copy from 'copy-to-clipboard'
// material ui
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import CloseIcon from '@material-ui/icons/Close'
import CircularProgress from '@material-ui/core/CircularProgress'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import { Container } from '@material-ui/core'
import DialogTitle from '@material-ui/core/DialogTitle'
import Divider from '@material-ui/core/Divider'
import IconButton from '@material-ui/core/IconButton'
import GetAppIcon from '@material-ui/icons/GetApp'
import TextField from '@material-ui/core/TextField'

// core
import { getSession } from '@jbrowse/core/util'
// other
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
  },
}))

function SequenceDialog({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const classes = useStyles()
  const session = getSession(model)
  const loading = model.selectedSequence === undefined
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
          Reference sequence
          {handleClose ? (
            <IconButton
              data-testid="close-seqDialog"
              className={classes.closeButton}
              onClick={() => {
                handleClose()
                model.showSeqDialog(false)
                model.setSelectedSeqRegion(undefined)
                model.disableGetSequence(false)
                model.disableCopyToClipBoard(false)
              }}
            >
              <CloseIcon />
            </IconButton>
          ) : null}
        </DialogTitle>
        <Divider />

        <>
          <DialogContent>
            {loading ? (
              <Container>
                Retrieving reference sequence...
                <CircularProgress
                  style={{
                    marginLeft: 10,
                  }}
                  size={20}
                  disableShrink
                />
              </Container>
            ) : (
              <TextField
                data-testid="rubberband-sequence"
                variant="outlined"
                multiline
                rows={3}
                rowsMax={5}
                disabled={model.copyToClipboardDisabled}
                className={classes.dialogContent}
                fullWidth
                value={
                  model.copyToClipboardDisabled
                    ? 'Reference sequence too large to display'
                    : model.selectedSequence
                }
                InputProps={{
                  readOnly: true,
                }}
              />
            )}
          </DialogContent>
        </>
        <DialogActions>
          <Button
            onClick={() => {
              try {
                copy(model?.selectedSequence || '')
                session.notify('Copied to clipboard', 'success')
              } catch (error) {
                session.notify(
                  'Error occurred attempting to copy to clipboard',
                  'error',
                )
              }
            }}
            disabled={
              loading ||
              model.copyToClipboardDisabled ||
              copy('no clipboard support') === false
            }
            color="primary"
            startIcon={<ContentCopyIcon />}
          >
            Copy to clipboard
          </Button>
          <Button
            onClick={() => {
              const selectedSeq = new Blob([model?.selectedSequence || ''], {
                type: 'text/x-fasta;charset=utf-8',
              })
              saveAs(selectedSeq, 'JBrowseSelectedRefSeq.fa')
            }}
            disabled={loading}
            color="primary"
            startIcon={<GetAppIcon />}
          >
            Download FASTA
          </Button>
          <Button
            onClick={() => {
              handleClose()
              model.showSeqDialog(false)
              model.setSelectedSeqRegion(undefined)
              model.disableGetSequence(false)
              model.disableCopyToClipBoard(false)
            }}
            color="primary"
            autoFocus
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default observer(SequenceDialog)
