import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { DialogContent, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import UcscQueryActions from './UcscQueryActions.tsx'
import UcscQueryFields from './UcscQueryFields.tsx'
import UcscQueryStatus from './UcscQueryStatus.tsx'
import {
  DEFAULT_ISPCR_URL,
  DEFAULT_MAX_PRODUCT_SIZE,
  MINIMUM_PRIMER_LENGTH,
  buildIsPcrBody,
  parseIsPcrResponse,
} from './ispcrQuery.ts'
import { runUcscFetch, useUcscQuery } from './useUcscQuery.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

function cleanPrimer(seq: string) {
  return seq.replaceAll(/\s/g, '').toUpperCase()
}

const IsPcrDialog = observer(function IsPcrDialog({
  session,
  handleClose,
}: {
  session: AbstractSessionModel
  handleClose: () => void
}) {
  const query = useUcscQuery({
    session,
    handleClose,
    defaultUrl: DEFAULT_ISPCR_URL,
  })
  const { db, urlBase, apiKey } = query
  const [forwardPrimer, setForwardPrimer] = useState('')
  const [reversePrimer, setReversePrimer] = useState('')
  const [maxProductSize, setMaxProductSize] = useState(
    String(DEFAULT_MAX_PRODUCT_SIZE),
  )

  const fwd = cleanPrimer(forwardPrimer)
  const rev = cleanPrimer(reversePrimer)
  const maxProductSizeNum = Number(maxProductSize)
  const maxProductSizeValid =
    Number.isFinite(maxProductSizeNum) && maxProductSizeNum > 0
  const tooShort =
    fwd.length < MINIMUM_PRIMER_LENGTH || rev.length < MINIMUM_PRIMER_LENGTH

  async function handleSubmit() {
    await query.runQuery({
      fetchFeatures: () =>
        runUcscFetch({
          urlBase,
          body: buildIsPcrBody({
            db,
            forwardPrimer: fwd,
            reversePrimer: rev,
            maxProductSize: maxProductSizeNum,
            apiKey,
          }),
          parse: parseIsPcrResponse,
        }),
      trackIdPrefix: 'ispcr',
      trackName: `In-silico PCR ${new Date().toLocaleTimeString()}`,
      emptyMessage: 'No PCR products found',
    })
  }

  return (
    <Dialog
      open
      title="In-silico PCR (UCSC)"
      onClose={() => {
        handleClose()
      }}
    >
      <DialogContent
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <Typography>
          Enter a forward and reverse primer to find their PCR products against
          the UCSC in-silico PCR server. Products are added as a new track.
        </Typography>
        <UcscQueryFields
          session={session}
          query={query}
          urlLabel="In-silico PCR server URL"
        />
        <TextField
          label="Forward primer"
          value={forwardPrimer}
          onChange={event => {
            setForwardPrimer(event.target.value)
          }}
          placeholder="e.g. GTGACGTCGTGACCTAGG"
          slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
        />
        <TextField
          label="Reverse primer"
          value={reversePrimer}
          onChange={event => {
            setReversePrimer(event.target.value)
          }}
          placeholder="e.g. CCTAGGTTGACGTCACGA"
          slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
        />
        <TextField
          label="Max product size (bp)"
          type="number"
          value={maxProductSize}
          onChange={event => {
            setMaxProductSize(event.target.value)
          }}
          error={!maxProductSizeValid}
          helperText={maxProductSizeValid ? '' : 'Enter a positive number'}
        />
        {tooShort && (fwd || rev) ? (
          <Typography color="error">
            {`Primers must be at least ${MINIMUM_PRIMER_LENGTH} bp`}
          </Typography>
        ) : null}
        <UcscQueryStatus query={query} />
      </DialogContent>
      <UcscQueryActions
        query={query}
        submitDisabled={tooShort || !maxProductSizeValid || !db}
        onSubmit={() => void handleSubmit()}
        onCancel={() => {
          handleClose()
        }}
      />
    </Dialog>
  )
})

export default IsPcrDialog
