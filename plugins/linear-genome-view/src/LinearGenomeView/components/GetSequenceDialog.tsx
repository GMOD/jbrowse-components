import React, { useEffect, useState } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { Dialog } from '@jbrowse/core/ui'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import { getSession, reverse, complement } from '@jbrowse/core/util'
import { formatSeqFasta } from '@jbrowse/core/util/formatFastaStrings'

// icons
import GetAppIcon from '@mui/icons-material/GetApp'
import {
  Button,
  Checkbox,
  CircularProgress,
  Container,
  DialogActions,
  DialogContent,
  FormGroup,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material'
import copy from 'copy-to-clipboard'
import { saveAs } from 'file-saver'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { LinearGenomeViewModel } from '..'
import type { Feature, Region } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

type LGV = LinearGenomeViewModel

/**
 * Fetches and returns a list features for a given list of regions
 */
async function fetchSequence(model: LGV, regions: Region[]) {
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
  }) as Promise<Feature[]>
}

const GetSequenceDialog = observer(function ({
  model,
  handleClose,
}: {
  model: LGV
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [error, setError] = useState<unknown>()
  const [sequenceChunks, setSequenceChunks] = useState<Feature[]>()
  const [rev, setReverse] = useState(false)
  const [copied, setCopied] = useState(false)
  const [comp, setComplement] = useState(false)
  const { leftOffset, rightOffset } = model
  const loading = Boolean(sequenceChunks === undefined)

  useEffect(() => {
    const controller = new AbortController()

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        // random note: the current selected region can't be a computed because
        // it uses action on base1dview even though it's on the ephemeral
        // base1dview
        const selection = model.getSelectedRegions(leftOffset, rightOffset)
        if (selection.length === 0) {
          throw new Error('Selected region is out of bounds')
        }
        // TODO:ABORT
        const chunks = await fetchSequence(model, selection)
        setSequenceChunks(chunks)
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [model, leftOffset, rightOffset])

  const sequence = sequenceChunks
    ? formatSeqFasta(
        sequenceChunks.map(chunk => {
          let chunkSeq = chunk.get('seq')
          const chunkRefName = chunk.get('refName')
          const chunkStart = chunk.get('start') + 1
          const chunkEnd = chunk.get('end')
          const loc = `${chunkRefName}:${chunkStart}-${chunkEnd}`
          if (chunkSeq?.length !== chunkEnd - chunkStart + 1) {
            throw new Error(
              `${loc} returned ${chunkSeq.length.toLocaleString()} bases, but should have returned ${(
                chunkEnd - chunkStart
              ).toLocaleString()}`,
            )
          }

          if (rev) {
            chunkSeq = reverse(chunkSeq)
          }
          if (comp) {
            chunkSeq = complement(chunkSeq)
          }
          return {
            header: loc + (rev ? '-rev' : '') + (comp ? '-comp' : ''),
            seq: chunkSeq,
          }
        }),
      )
    : ''

  const sequenceTooLarge = sequence ? sequence.length > 1_000_000 : false

  return (
    <Dialog
      maxWidth="xl"
      open
      onClose={() => {
        handleClose()
        model.setOffsets()
      }}
      title="Reference sequence"
    >
      <DialogContent>
        {error ? (
          <Typography color="error">{`${error}`}</Typography>
        ) : loading ? (
          <Container>
            Retrieving reference sequence...
            <CircularProgress
              style={{ marginLeft: 10 }}
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
          maxRows={10}
          disabled={sequenceTooLarge}
          className={classes.dialogContent}
          fullWidth
          value={
            sequenceTooLarge
              ? 'Reference sequence too large to display, use the download FASTA button'
              : sequence
          }
          slotProps={{
            input: {
              readOnly: true,
              classes: {
                input: classes.textAreaFont,
              },
            },
          }}
        />
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                value={rev}
                onChange={event => {
                  setReverse(event.target.checked)
                }}
              />
            }
            label="Reverse sequence"
          />
          <FormControlLabel
            control={
              <Checkbox
                value={comp}
                onChange={event => {
                  setComplement(event.target.checked)
                }}
              />
            }
            label="Complement sequence"
          />
        </FormGroup>
        <Typography style={{ margin: 10 }}>
          Note: Check both boxes for the &quot;reverse complement&quot;
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            copy(sequence)
            setCopied(true)
            setTimeout(() => {
              setCopied(false)
            }, 500)
          }}
          disabled={loading || !!error || sequenceTooLarge}
          color="primary"
          startIcon={<ContentCopyIcon />}
        >
          {copied ? 'Copied' : 'Copy to clipboard'}
        </Button>
        <Button
          onClick={() => {
            saveAs(
              new Blob([sequence || ''], {
                type: 'text/x-fasta;charset=utf-8',
              }),
              'jbrowse_ref_seq.fa',
            )
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
})

export default GetSequenceDialog
