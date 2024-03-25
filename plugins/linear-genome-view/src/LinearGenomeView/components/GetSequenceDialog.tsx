import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'
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
import { observer } from 'mobx-react'
import { saveAs } from 'file-saver'
import { getConf } from '@jbrowse/core/configuration'
import copy from 'copy-to-clipboard'
import { Dialog } from '@jbrowse/core/ui'
import {
  getSession,
  reverse,
  complement,
  Feature,
  Region,
} from '@jbrowse/core/util'
import { formatSeqFasta } from '@jbrowse/core/util/formatFastaStrings'

// icons
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import GetAppIcon from '@mui/icons-material/GetApp'

// locals
import { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

type LGV = LinearGenomeViewModel

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

const GetSequenceDialog = observer(function ({
  model,
  handleClose,
}: {
  model: LGV
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const [error, setError] = useState<unknown>()
  const [sequenceChunks, setSequenceChunks] = useState<Feature[]>()
  const [rev, setReverse] = useState(false)
  const [copied, setCopied] = useState(false)
  const [comp, setComplement] = useState(false)
  const { leftOffset, rightOffset } = model
  const loading = Boolean(sequenceChunks === undefined)

  useEffect(() => {
    let active = true
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
        const chunks = await fetchSequence(model, selection, controller.signal)
        if (active) {
          setSequenceChunks(chunks)
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
  }, [model, session, leftOffset, rightOffset])

  const sequence = sequenceChunks
    ? formatSeqFasta(
        sequenceChunks
          .filter(f => !!f)
          .map(chunk => {
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
          InputProps={{
            readOnly: true,
            classes: {
              input: classes.textAreaFont,
            },
          }}
        />
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                value={rev}
                onChange={event => setReverse(event.target.checked)}
              />
            }
            label="Reverse sequence"
          />
          <FormControlLabel
            control={
              <Checkbox
                value={comp}
                onChange={event => setComplement(event.target.checked)}
              />
            }
            label="Complement sequence"
          />
        </FormGroup>
        <Typography style={{ margin: 10 }}>
          Note: Check both boxes for the "reverse complement"
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            copy(sequence)
            setCopied(true)
            setTimeout(() => setCopied(false), 500)
          }}
          disabled={loading || !!error || sequenceTooLarge}
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
