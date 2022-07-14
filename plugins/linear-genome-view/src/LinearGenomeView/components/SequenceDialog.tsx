import React, { useEffect, useMemo, useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import {
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { saveAs } from 'file-saver'
import { Region } from '@jbrowse/core/util/types'
import { getConf } from '@jbrowse/core/configuration'
import copy from 'copy-to-clipboard'
import { getSession } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { formatSeqFasta } from '@jbrowse/core/util/formatFastaStrings'

// icons
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import CloseIcon from '@mui/icons-material/Close'
import GetAppIcon from '@mui/icons-material/GetApp'

// locals
import { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()(theme => ({
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

type LGV = LinearGenomeViewModel

/**
 * Fetches and returns a list features for a given list of regions
 */
async function fetchSequence(
  model: LGV,
  regions: Region[],
  signal?: AbortSignal,
) {
  const session = getSession(model)
  const { leftOffset, rightOffset } = model

  if (!leftOffset || !rightOffset) {
    throw new Error('no offsets on model to use for range')
  }

  if (leftOffset.assemblyName !== rightOffset.assemblyName) {
    throw new Error('not able to fetch sequences from multiple assemblies')
  }
  const { rpcManager, assemblyManager } = session
  const assemblyName = leftOffset.assemblyName || rightOffset.assemblyName || ''
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  const adapterConfig = getConf(assembly, ['sequence', 'adapter'])

  const sessionId = 'getSequence'
  return rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig,
    regions,
    sessionId,
    signal,
  }) as Promise<Feature[]>
}

function SequenceDialog({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const [error, setError] = useState<unknown>()
  const [sequence, setSequence] = useState<string>()
  const loading = Boolean(sequence === undefined)
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
    const controller = new AbortController()

    ;(async () => {
      try {
        if (regionsSelected.length > 0) {
          const chunks = await fetchSequence(
            model,
            regionsSelected,
            controller.signal,
          )
          if (active) {
            setSequence(
              formatSeqFasta(
                chunks
                  .filter(f => !!f)
                  .map(chunk => {
                    const chunkSeq = chunk.get('seq')
                    const chunkRefName = chunk.get('refName')
                    const chunkStart = chunk.get('start') + 1
                    const chunkEnd = chunk.get('end')
                    const chunkLocstring = `${chunkRefName}:${chunkStart}-${chunkEnd}`
                    if (chunkSeq?.length !== chunkEnd - chunkStart + 1) {
                      throw new Error(
                        `${chunkLocstring} returned ${chunkSeq.length.toLocaleString()} bases, but should have returned ${(
                          chunkEnd - chunkStart
                        ).toLocaleString()}`,
                      )
                    }
                    return { header: chunkLocstring, seq: chunkSeq }
                  }),
              ),
            )
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
      controller.abort()
      active = false
    }
  }, [model, session, regionsSelected, setSequence])

  const sequenceTooLarge = sequence ? sequence.length > 1_000_000 : false

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
            size="large"
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
        <TextField
          data-testid="rubberband-sequence"
          variant="outlined"
          multiline
          minRows={5}
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
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            copy(sequence || '')
            session.notify('Copied to clipboard', 'success')
          }}
          disabled={loading || !!error || sequenceTooLarge}
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
          disabled={loading || !!error}
          color="primary"
          startIcon={<GetAppIcon />}
        >
          Download FASTA
        </Button>
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(SequenceDialog)
