import React, { useEffect, useState } from 'react'
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
import { Container, Typography } from '@material-ui/core'
import DialogTitle from '@material-ui/core/DialogTitle'
import Divider from '@material-ui/core/Divider'
import IconButton from '@material-ui/core/IconButton'
import GetAppIcon from '@material-ui/icons/GetApp'
import TextField from '@material-ui/core/TextField'

// core
import { getSession } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
// other
import { formatSeqFasta, SeqChunk } from '@jbrowse/core/util/formatFastaStrings'
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
  const [error, setError] = useState<Error>()
  const [regionsSet, setRegions] = useState<boolean>(false)
  const [sequence, setSequence] = useState<string>()
  const [copyDisabled, disableCopy] = useState<boolean>(true)
  const [downloadDisabled, disableDownload] = useState<boolean>(true)
  const loading = sequence === undefined && error === undefined
  // convert from 1-based closed to interbase
  const regionsSelected = model
    .getSelectedRegions(model.leftOffset, model.rightOffset)
    .map(region => {
      return {
        ...region,
        start: region.start - 1,
      }
    })
  if (regionsSet === false) {
    setRegions(true)
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        if (regionsSet && regionsSelected.length > 0 && active) {
          const chunks = await model.fetchSequence(regionsSelected)
          if (chunks.length > 0) {
            formatSequence(chunks)
          }
        } else if (
          active &&
          error === undefined &&
          regionsSelected.length === 0
        ) {
          setError(new Error('Selected region is out of bounds'))
        }
      } catch (e) {
        if (active) {
          setError(e)
        }
      }
    })()

    return () => {
      active = false
    }
  })

  function formatSequence(seqChunks: Feature[]) {
    const sequenceChunks: SeqChunk[] = []
    const incompleteSeqErrs: string[] = []
    seqChunks.forEach((chunk: Feature) => {
      const chunkSeq = chunk.get('seq')
      const chunkRefName = chunk.get('refName')
      const chunkStart = chunk.get('start') + 1
      const chunkEnd = chunk.get('end')
      const chunkLocstring = `${chunkRefName}:${chunkStart}-${chunkEnd}`
      if (chunkSeq) {
        sequenceChunks.push({ header: chunkLocstring, seq: chunkSeq })
        if (chunkSeq.length !== chunkEnd - chunkStart + 1) {
          incompleteSeqErrs.push(
            `${chunkLocstring} returned ${chunkSeq.length.toLocaleString()} bases, but should have returned ${(
              chunkEnd - chunkStart
            ).toLocaleString()}`,
          )
        }
      }
    })
    if (incompleteSeqErrs.length > 0) {
      session.notify(
        `Unable to retrieve complete reference sequence from regions:${incompleteSeqErrs.join()}`,
      )
    }
    const seqFasta = formatSeqFasta(sequenceChunks)
    const checkingSize = new Blob([seqFasta]).size
    if (checkingSize > 500000000) {
      disableCopy(true)
    } else {
      if (checkingSize > 100000) {
        disableCopy(true)
        session.notify(
          `Copy to clipboard was disabled. Please download as Fasta file.`,
        )
      }
      setSequence(seqFasta)
      disableDownload(false)
      disableCopy(false)
    }
  }

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
                model.setOffsets(undefined, undefined)
              }}
            >
              <CloseIcon />
            </IconButton>
          ) : null}
        </DialogTitle>
        <Divider />

        <>
          <DialogContent>
            {error ? <Typography color="error">{`${error}`}</Typography> : null}
            {loading && !error ? (
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
            ) : null}
            {sequence !== undefined ? (
              <TextField
                data-testid="rubberband-sequence"
                variant="outlined"
                multiline
                rows={3}
                rowsMax={5}
                disabled={copyDisabled}
                className={classes.dialogContent}
                fullWidth
                value={
                  copyDisabled
                    ? 'Reference sequence too large to display'
                    : sequence
                }
                InputProps={{
                  readOnly: true,
                }}
              />
            ) : null}
          </DialogContent>
        </>
        <DialogActions>
          <Button
            onClick={() => {
              copy(sequence || '')
              session.notify('Copied to clipboard', 'success')
            }}
            disabled={loading || copyDisabled || sequence === undefined}
            color="primary"
            startIcon={<ContentCopyIcon />}
          >
            Copy to clipboard
          </Button>
          <Button
            onClick={() => {
              const seqFastaFile = new Blob([sequence || ''], {
                type: 'text/x-fasta;charset=utf-8',
              })
              saveAs(seqFastaFile, 'jbrowse_ref_seq.fa')
            }}
            disabled={loading || downloadDisabled || sequence === undefined}
            color="primary"
            startIcon={<GetAppIcon />}
          >
            Download FASTA
          </Button>
          <Button
            onClick={() => {
              handleClose()
              model.showSeqDialog(false)
              model.setOffsets(undefined, undefined)
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
