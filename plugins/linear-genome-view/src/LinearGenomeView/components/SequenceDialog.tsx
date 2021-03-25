import React, { useEffect, useMemo, useState } from 'react'
import { observer } from 'mobx-react'
import { saveAs } from 'file-saver'
import { Region } from '@jbrowse/core/util/types'
import { readConfObject } from '@jbrowse/core/configuration'
import copy from 'copy-to-clipboard'
import { makeStyles } from '@material-ui/core/styles'
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Container,
  Typography,
  Divider,
  IconButton,
  TextField,
} from '@material-ui/core'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import CloseIcon from '@material-ui/icons/Close'
import GetAppIcon from '@material-ui/icons/GetApp'
import { getSession } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
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
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
}))

/**
 * Fetches and returns a list features for a given list of regions
 * @param selectedRegions - Region[]
 * @returns Features[]
 */
async function fetchSequence(
  self: LinearGenomeViewModel,
  selectedRegions: Region[],
) {
  const session = getSession(self)
  const assemblyName =
    self.leftOffset?.assemblyName || self.rightOffset?.assemblyName || ''
  const { rpcManager, assemblyManager } = session
  const assemblyConfig = assemblyManager.get(assemblyName)?.configuration

  // assembly configuration
  const adapterConfig = readConfObject(assemblyConfig, ['sequence', 'adapter'])

  const sessionId = 'getSequence'
  const chunks = (await Promise.all(
    selectedRegions.map(region =>
      rpcManager.call(sessionId, 'CoreGetFeatures', {
        adapterConfig,
        region,
        sessionId,
      }),
    ),
  )) as Feature[][]

  // assumes that we get whole sequence in a single getFeatures call
  return chunks.map(chunk => chunk[0])
}

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
  const [sequence, setSequence] = useState('')
  const loading = Boolean(!sequence) || Boolean(error)
  const { leftOffset, rightOffset } = model

  // avoid infinite looping of useEffect
  // random note: the current selected region can't be a computed because it
  // uses action on base1dview even though it's on the ephemeral base1dview
  const regionsSelected = useMemo(
    () => model.getSelectedRegions(leftOffset, rightOffset),
    [model, leftOffset, rightOffset],
  )

  useEffect(() => {
    let active = true

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
      setSequence(formatSeqFasta(sequenceChunks))
    }

    ;(async () => {
      try {
        if (regionsSelected.length > 0) {
          const chunks = await fetchSequence(model, regionsSelected)
          if (active) {
            formatSequence(chunks)
          }
        } else {
          throw new Error('Selected region is out of bounds')
        }
      } catch (e) {
        console.error(e)
        if (active) {
          setError(e)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [model, session, regionsSelected, setSequence])

  const sequenceTooLarge = sequence.length > 1_000_000

  return (
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
              model.setOffsets(undefined, undefined)
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
      <Divider />

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
            disabled={sequenceTooLarge}
            className={classes.dialogContent}
            fullWidth
            value={
              sequenceTooLarge
                ? 'Reference sequence too large to display, use the download FASTA button'
                : sequence
            }
            InputProps={{
              readOnly: true,
              classes: {
                input: classes.textAreaFont,
              },
            }}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            copy(sequence || '')
            session.notify('Copied to clipboard', 'success')
          }}
          disabled={loading || sequenceTooLarge}
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
          disabled={loading}
          color="primary"
          startIcon={<GetAppIcon />}
        >
          Download FASTA
        </Button>
        <Button
          onClick={() => {
            handleClose()
            model.setOffsets(undefined, undefined)
          }}
          color="primary"
          autoFocus
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(SequenceDialog)
