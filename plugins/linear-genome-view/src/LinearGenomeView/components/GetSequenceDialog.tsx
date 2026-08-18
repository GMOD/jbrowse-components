import { useState } from 'react'

import {
  CopyToClipboardButton,
  Dialog,
  ErrorBanner,
  LabeledCheckbox,
  LoadingEllipses,
  MonospaceTextField,
} from '@jbrowse/core/ui'
import {
  complement,
  reverse,
  statusProgressLabel,
  toLocale,
} from '@jbrowse/core/util'
import { formatSeqFasta } from '@jbrowse/core/util/formatFastaStrings'
import { useFetch } from '@jbrowse/core/util/useFetch'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GetAppIcon from '@mui/icons-material/GetApp'
import {
  Button,
  DialogActions,
  DialogContent,
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
//
// The display limit is in FASTA characters, not bp — it caps what goes into the
// textarea, which is the formatted output including headers and line breaks.
const MAX_DISPLAY_CHARS = 1_000_000
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

  const {
    data: sequenceChunks,
    error,
    isLoading: loading,
    status,
  } = useFetch(
    tooLargeToFetch
      ? false
      : ([
          'fetchSequence',
          regions.map(r => `${r.refName}:${r.start}-${r.end}`),
        ] as const),
    // a selection this dialog will happily take is a whole chromosome of
    // sequence, so both handles are forwarded: closing the dialog stops the
    // read rather than leaving the worker on it, and the wait is named
    async (_name, _locs, stopToken, statusCallback) => {
      if (regions.length === 0) {
        throw new Error('Selected region is out of bounds')
      }
      const chunks = await fetchSequence(model, regions, {
        stopToken,
        statusCallback,
      })
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
  const entries =
    sequenceChunks?.map(({ loc, seq }) => {
      const revSeq = rev ? reverse(seq) : seq
      return {
        header: loc + (rev ? '-rev' : '') + (comp ? '-comp' : ''),
        seq: comp ? complement(revSeq) : revSeq,
      }
    }) ?? []
  const sequence = formatSeqFasta(entries)
  const plainSequence = entries.map(e => e.seq).join('\n')
  const sequenceTooLarge = sequence.length > MAX_DISPLAY_CHARS
  // What the textarea says instead of a sequence. `tooLargeToFetch` disables the
  // fetch, so without this branch it left an empty box with no loading state, no
  // error and no explanation — and a Download FASTA button that wrote 0 bytes.
  const notice = tooLargeToFetch
    ? `Selected region is ${toLocale(totalBp)}bp, over the ${toLocale(
        MAX_FETCH_BP,
      )}bp limit for fetching a reference sequence. Zoom in or select a smaller region.`
    : sequenceTooLarge
      ? 'Reference sequence too large to display, use the download FASTA button'
      : undefined

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
          <LoadingEllipses
            message={statusProgressLabel(status) || 'Retrieving sequences'}
          />
        ) : null}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <CopyToClipboardButton
            value={plainSequence}
            copiedLabel="Copied"
            disabled={!plainSequence || sequenceTooLarge}
            variant="contained"
            color="primary"
            size="small"
            startIcon={<ContentCopyIcon />}
          >
            Copy plain text
          </CopyToClipboardButton>
          <CopyToClipboardButton
            value={sequence}
            copiedLabel="Copied"
            disabled={!sequence || sequenceTooLarge}
            variant="contained"
            color="primary"
            size="small"
            startIcon={<ContentCopyIcon />}
          >
            Copy FASTA
          </CopyToClipboardButton>
        </div>
        <MonospaceTextField
          fullWidth
          readOnly
          minRows={5}
          maxRows={10}
          disabled={notice !== undefined}
          value={notice ?? sequence}
        />
        <FormGroup>
          <LabeledCheckbox
            checked={rev}
            onChange={val => {
              setRev(val)
            }}
            label="Reverse sequence"
          />
          <LabeledCheckbox
            checked={comp}
            onChange={val => {
              setComp(val)
            }}
            label="Complement sequence"
          />
        </FormGroup>
        <Typography style={{ margin: 10 }}>
          Note: Check both boxes for the &quot;reverse complement&quot;
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={async () => {
            const { saveAs } = await import('@jbrowse/core/util/FileSaver')
            saveAs(
              new Blob([sequence], {
                type: 'text/x-fasta;charset=utf-8',
              }),
              'jbrowse_ref_seq.fa',
            )
          }}
          // `!sequence` covers every path with nothing to write: still loading,
          // errored, and the over-fetch-limit refusal
          disabled={!sequence}
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
