import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { DialogContent, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import UcscQueryActions from './UcscQueryActions.tsx'
import UcscQueryFields from './UcscQueryFields.tsx'
import UcscQueryStatus from './UcscQueryStatus.tsx'
import {
  DEFAULT_BLAT_URL,
  MAXIMUM_BLAT_LENGTH,
  MINIMUM_BLAT_LENGTH,
  buildBlatBody,
  parseBlatResponse,
} from './blatQuery.ts'
import { runUcscFetch, useUcscQuery } from './useUcscQuery.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

function stripFasta(seq: string) {
  return seq
    .split('\n')
    .filter(line => !line.startsWith('>'))
    .join('')
    .replaceAll(/\s/g, '')
}

const BlatDialog = observer(function BlatDialog({
  session,
  handleClose,
}: {
  session: AbstractSessionModel
  handleClose: () => void
}) {
  const query = useUcscQuery({
    session,
    handleClose,
    defaultUrl: DEFAULT_BLAT_URL,
  })
  const { db, urlBase, apiKey } = query
  const [seq, setSeq] = useState('')

  const cleanSeq = stripFasta(seq)
  const tooShort = cleanSeq.length < MINIMUM_BLAT_LENGTH
  const tooLong = cleanSeq.length > MAXIMUM_BLAT_LENGTH
  const seqError = tooLong
    ? `Sequence is ${cleanSeq.length.toLocaleString()} bp; UCSC BLAT is limited to ${MAXIMUM_BLAT_LENGTH.toLocaleString()} bp`
    : tooShort && cleanSeq
      ? `Sequence must be at least ${MINIMUM_BLAT_LENGTH} bp`
      : ''

  async function handleSubmit() {
    await query.runQuery({
      fetchFeatures: () =>
        runUcscFetch({
          urlBase,
          body: buildBlatBody({ db, seq: cleanSeq, apiKey }),
          parse: parseBlatResponse,
        }),
      trackIdPrefix: 'blat',
      trackName: `BLAT ${new Date().toLocaleTimeString()}`,
      emptyMessage: 'No BLAT hits found',
    })
  }

  return (
    <Dialog
      open
      title="BLAT search (UCSC)"
      onClose={() => {
        handleClose()
      }}
    >
      <DialogContent
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <TextField
          label="Sequence"
          variant="outlined"
          value={seq}
          onChange={event => {
            setSeq(event.target.value)
          }}
          multiline
          minRows={6}
          maxRows={14}
          autoFocus
          placeholder="Paste a DNA sequence or FASTA to search against the UCSC BLAT server"
          error={!!seqError}
          helperText={
            seqError ||
            'DNA or FASTA, up to 25 kb. Results are added as a new track.'
          }
          slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
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
        submitDisabled={tooShort || tooLong || !db}
        onSubmit={() => void handleSubmit()}
        onCancel={() => {
          handleClose()
        }}
      />
    </Dialog>
  )
})

export default BlatDialog
