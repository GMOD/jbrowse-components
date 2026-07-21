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

import type { Region } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// Guard on the requested span, before fetching, so a whole-chromosome request
// (easy to trigger now that features/regions can open this) never round-trips
// megabases just to be display-blocked. Above the display limit the sequence is
// still downloadable; above the fetch limit it is refused outright.
const MAX_DISPLAY_BP = 1_000_000
const MAX_FETCH_BP = 10_000_000

const GetSequenceDialog = observer(function GetSequenceDialog({
  model,
  regions,
  handleClose,
}: {
  model: IAnyStateTreeNode
  regions: Region[]
  handleClose: () => void
}) {
  const [rev, setRev] = useState(false)
  const [comp, setComp] = useState(false)

  const totalBp = regions.reduce((a, r) => a + (r.end - r.start), 0)
  const tooLargeToFetch = totalBp > MAX_FETCH_BP

  const { data: sequenceChunks, error } = useFetch(
    tooLargeToFetch
      ? false
      : ['fetchSequence', regions.map(r => `${r.refName}:${r.start}-${r.end}`)],
    async () => {
      if (regions.length === 0) {
        throw new Error('Selected region is out of bounds')
      }
      const chunks = await fetchSequence(model, regions)
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
  const loading = !tooLargeToFetch && sequenceChunks === undefined && !error
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
  const sequenceTooLarge = sequence ? sequence.length > MAX_DISPLAY_BP : false

  return (
    <Dialog
      maxWidth="xl"
      open
      title="Reference sequence"
      onClose={() => {
        handleClose()
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
