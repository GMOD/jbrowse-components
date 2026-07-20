import { useState } from 'react'

import {
  CopyToClipboardButton,
  Dialog,
  ErrorBanner,
  LoadingEllipses,
  MonospaceTextField,
} from '@jbrowse/core/ui'
import { complement, reverse, toLocale, useFetch } from '@jbrowse/core/util'
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
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { fetchSequence } from './fetchSequence.ts'

import type { BpOffset } from '../types.ts'
import type { Region } from '@jbrowse/core/util'

const GetSequenceDialog = observer(function GetSequenceDialog({
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
  const [rev, setRev] = useState(false)
  const [comp, setComp] = useState(false)
  const { leftOffset, rightOffset } = model

  const { data: sequenceChunks, error } = useFetch(
    [
      'fetchSequence',
      leftOffset?.refName,
      leftOffset?.coord,
      rightOffset?.refName,
      rightOffset?.coord,
    ],
    async () => {
      // random note: the current selected region can't be a computed because
      // it uses action on base1dview even though it's on the ephemeral
      // base1dview
      const selection = model.getSelectedRegions(leftOffset, rightOffset)
      if (selection.length === 0) {
        throw new Error('Selected region is out of bounds')
      }
      const chunks = await fetchSequence(model, selection)
      // validate here (in the async path) so a length mismatch surfaces via the
      // dialog's own ErrorBanner rather than throwing during render
      return chunks.map(chunk => {
        const seq = chunk.get('seq') as string
        const start = chunk.get('start') + 1
        const end = chunk.get('end')
        const loc = `${chunk.get('refName')}:${start}-${end}`
        if (seq.length !== end - start + 1) {
          throw new Error(
            `${loc} returned ${toLocale(seq.length)} bases, but should have returned ${toLocale(
              end - start + 1,
            )}`,
          )
        }
        return { loc, seq }
      })
    },
  )
  const loading = sequenceChunks === undefined && !error

  const sequence = sequenceChunks
    ? formatSeqFasta(
        sequenceChunks.map(({ loc, seq }) => {
          const revSeq = rev ? reverse(seq) : seq
          return {
            header: loc + (rev ? '-rev' : '') + (comp ? '-comp' : ''),
            seq: comp ? complement(revSeq) : revSeq,
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
      <DialogContent style={{ width: '80em' }}>
        {error ? (
          <ErrorBanner error={error} />
        ) : loading ? (
          <LoadingEllipses message="Retrieving sequences" />
        ) : null}
        <MonospaceTextField
          fullWidth
          readOnly
          minRows={5}
          maxRows={10}
          disabled={sequenceTooLarge}
          value={
            sequenceTooLarge
              ? 'Reference sequence too large to display, use the download FASTA button'
              : sequence
          }
        />
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={rev}
                onChange={event => {
                  setRev(event.target.checked)
                }}
              />
            }
            label="Reverse sequence"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={comp}
                onChange={event => {
                  setComp(event.target.checked)
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
        <CopyToClipboardButton
          value={sequence}
          copiedLabel="Copied"
          disabled={loading || !!error || sequenceTooLarge}
          color="primary"
          startIcon={<ContentCopyIcon />}
        >
          Copy to clipboard
        </CopyToClipboardButton>
        <Button
          variant="contained"
          onClick={async () => {
            const { saveAs } = await import('@jbrowse/core/util')
            saveAs(
              new Blob([sequence], {
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
        <Button
          onClick={() => {
            handleClose()
            model.setOffsets()
          }}
          variant="contained"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default GetSequenceDialog
