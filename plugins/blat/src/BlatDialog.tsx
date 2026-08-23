import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import MonospaceTextField from './MonospaceTextField.tsx'
import UcscQueryActions from './UcscQueryActions.tsx'
import UcscQueryFields from './UcscQueryFields.tsx'
import UcscQueryStatus from './UcscQueryStatus.tsx'
import {
  DEFAULT_BLAT_URL,
  UCSC_BLAT_URL,
  MAXIMUM_BLAT_LENGTH,
  MAXIMUM_BLAT_QUERIES,
  MINIMUM_BLAT_LENGTH,
  buildBlatBody,
  fastaRecordCount,
  parseBlatResponse,
  pslToFeatures,
  queryLabel,
  stripFasta,
} from './blatQuery.ts'
import { parseQuerySequences, pslToSam } from './pslToSam.ts'
import { canRenderAlignments } from './ucscShared.ts'
import { runUcscFetch, useUcscQuery } from './useUcscQuery.ts'

import type { UcscHost } from './ucscShared.ts'

const BlatDialog = observer(function BlatDialog({
  session,
  handleClose,
}: {
  session: UcscHost
  handleClose: () => void
}) {
  const query = useUcscQuery({
    session,
    handleClose,
    defaultUrl: DEFAULT_BLAT_URL,
    directUrl: UCSC_BLAT_URL,
  })
  const { db, urlBase, fallbackUrl, apiKey } = query
  const [seq, setSeq] = useState('')

  const residues = stripFasta(seq)
  const queryCount = fastaRecordCount(seq)
  const tooShort = residues.length < MINIMUM_BLAT_LENGTH
  const tooLong = residues.length > MAXIMUM_BLAT_LENGTH
  const tooMany = queryCount > MAXIMUM_BLAT_QUERIES
  const seqError = tooLong
    ? `Sequence is ${residues.length.toLocaleString()} bp; UCSC BLAT is limited to ${MAXIMUM_BLAT_LENGTH.toLocaleString()} bp`
    : tooMany
      ? `${queryCount} sequences; UCSC BLAT is limited to ${MAXIMUM_BLAT_QUERIES} per query`
      : tooShort && residues
        ? `Sequence must be at least ${MINIMUM_BLAT_LENGTH} bp`
        : ''

  async function handleSubmit() {
    const label = queryLabel(seq)
    await query.runQuery({
      // PSL states each hit as aligned blocks in query and target coordinates,
      // which is a CIGAR alignment: converting to SAM and showing it in an
      // alignments track draws the hit's exon-like blocks, its indels, the
      // unaligned ends of the query as soft clips, and — since the submitted
      // sequence is right here — its mismatches against the reference.
      fetchResult: async () => {
        const rows = await runUcscFetch({
          urlBase,
          fallbackUrl,
          body: buildBlatBody({ db, seq: seq.trim(), apiKey }),
          parse: parseBlatResponse,
        })
        return {
          features: pslToFeatures(rows),
          // an older host has no SamAdapter; addResultTrack then falls back to
          // drawing the hits' block structure as a plain feature track
          trackConf: canRenderAlignments(session)
            ? {
                type: 'AlignmentsTrack',
                adapter: {
                  type: 'SamAdapter',
                  samText: pslToSam(rows, parseQuerySequences(seq)),
                },
                // A handful of hits has no depth to read, so the coverage band is 45
                // pixels saying "1" over the one place the query landed. The hits
                // themselves are the answer here, unlike a sequencing pileup.
                //
                // heightMode 'grow' would also be the natural fit (the content is a
                // few hits of known size, so the fixed lane is mostly empty), but a
                // single-hit track grown to its content comes out with the read
                // clipped by the bottom edge of the view. Left off until that is
                // understood.
                displayDefaults: { showCoverage: false },
              }
            : undefined,
        }
      },
      trackIdPrefix: 'blat',
      trackName:
        queryCount > 1 ? `BLAT ${label} +${queryCount - 1}` : `BLAT ${label}`,
      emptyMessage: `No BLAT hits found in ${db}`,
    })
  }

  return (
    <Dialog
      open
      // the sequence box is the dialog, and a pasted read or FASTA line wraps
      // every 40-odd bases at the default 600px — wide enough to read a
      // sequence without horizontal hunting
      maxWidth="md"
      fullWidth
      title="BLAT search (UCSC)"
      onClose={() => {
        handleClose()
      }}
    >
      <DialogContent
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <MonospaceTextField
          label="Sequence"
          value={seq}
          onChange={event => {
            setSeq(event.target.value)
          }}
          multiline
          minRows={6}
          maxRows={14}
          autoFocus
          placeholder="Paste a DNA sequence or FASTA to locate it in the genome"
          error={!!seqError}
          helperText={
            seqError ||
            'DNA, or FASTA with up to 25 records, 25 kb total. Hits are added as a track, and listed best-first in a panel where each one is a link.'
          }
        />
        <UcscQueryFields
          session={session}
          query={query}
          urlLabel="BLAT server URL"
        />
        <UcscQueryStatus query={query} />
      </DialogContent>
      <UcscQueryActions
        query={query}
        submitDisabled={tooShort || tooLong || tooMany || !db}
        onSubmit={() => void handleSubmit()}
        onCancel={() => {
          handleClose()
        }}
      />
    </Dialog>
  )
})

export default BlatDialog
