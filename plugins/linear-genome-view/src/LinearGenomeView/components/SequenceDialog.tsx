/* eslint-disable no-nested-ternary */
import React from 'react'
import Button from '@material-ui/core/Button'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Divider from '@material-ui/core/Divider'
import IconButton from '@material-ui/core/IconButton'
import GetAppIcon from '@material-ui/icons/GetApp';
import TextField from '@material-ui/core/TextField'
import CloseIcon from '@material-ui/icons/Close'
import copy from 'copy-to-clipboard'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import { LinearGenomeViewModel } from '..'

const useStyles = makeStyles(theme => ({
  shareDiv: {
    textAlign: 'center',
    paddingLeft: '2px',
  },
  shareButton: {
    '&:hover': {
      backgroundColor: fade(
        theme.palette.primary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
  loadingMessage: {
    padding: theme.spacing(5),
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

function SequenceDialog({
    model,
    handleClose
}: {
    model: LinearGenomeViewModel,
    handleClose: () => void
}) {
    const classes = useStyles()
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
              <IconButton className={classes.closeButton} onClick={handleClose}>
                <CloseIcon />
              </IconButton>
            ) : null}
          </DialogTitle>
          <Divider />

          <>
            <DialogContent>
              <DialogContentText id="alert-dialog-description">
                Get Sequence
              </DialogContentText>
            </DialogContent>

            <DialogContent>
                <TextField
                  label="rubberband-sequence"
                  value={"hello, this is where the sequence will go"}
                  InputProps={{
                    readOnly: true,
                  }}
                  variant="filled"
                  style={{ width: '100%' }}
                  onClick={event => {
                    const target = event.target as HTMLTextAreaElement
                    target.select()
                  }}
                />
     
            </DialogContent>
          </>
          <DialogActions>
            <Button
              onClick={() => {
                copy("hello, this is where the sequence will go")
                // session.notify('Copied to clipboard', 'success')
              }}
              color="primary"
              startIcon={<ContentCopyIcon />}
            >
              Copy Sequence to Clipboard
            </Button>
            <Button onClick={() => console.log("download fasta file")} 
                        color="primary"
                        startIcon={<GetAppIcon />}
            >
              FASTA
            </Button>
          </DialogActions>
        </Dialog>
      </>
    )
}
  
export default observer(SequenceDialog)
