import { useEffect, useState } from 'react'

import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { complement, reverse } from '@jbrowse/core/util'
import { formatSeqFasta } from '@jbrowse/core/util/formatFastaStrings'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GetAppIcon from '@mui/icons-material/GetApp'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  FormGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { fetchSequence } from './fetchSequence'

import type { BpOffset } from '../types'
import type { Feature, Region } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

const GetSequenceDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    leftOffset?: BpOffset
    rightOffset?: BpOffset
    getSelectedRegions: (left?: BpOffset, right?: BpOffset) => Region[]
    setOffsets: (left?: BpOffset, right?: BpOffset) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [error, setError] = useState<unknown>()
  const [sequenceChunks, setSequenceChunks] = useState<Feature[]>()
  const [rev, setReverse] = useState(false)
  const [copied, setCopied] = useState(false)
  const [comp, setComplement] = useState(false)
  const { leftOffset, rightOffset } = model
  const loading = sequenceChunks === undefined

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
        setSequenceChunks(await fetchSequence(model, selection))
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
      title="Reference sequence"
      onClose={() => {
        handleClose()
        model.setOffsets()
      }}
    >
      <DialogContent>
        {error ? (
          <ErrorMessage error={error} />
        ) : loading ? (
          <LoadingEllipses message="Retrieving sequences" />
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
          onClick={async () => {
            const { default: copy } = await import('copy-to-clipboard')
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
          onClick={async () => {
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            const { saveAs } = await import('file-saver-es')
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
