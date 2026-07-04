import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { isElectron } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import UcscQueryFields from './UcscQueryFields.tsx'
import {
  DEFAULT_ISPCR_URL,
  DEFAULT_MAX_PRODUCT_SIZE,
  MINIMUM_PRIMER_LENGTH,
  buildIsPcrBody,
  parseIsPcrResponse,
  runIsPcr,
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
  const { db, urlBase, apiKey, loading, challenged, error } = query
  const [forwardPrimer, setForwardPrimer] = useState('')
  const [reversePrimer, setReversePrimer] = useState('')
  const [maxProductSize, setMaxProductSize] = useState(DEFAULT_MAX_PRODUCT_SIZE)

  const fwd = cleanPrimer(forwardPrimer)
  const rev = cleanPrimer(reversePrimer)
  const tooShort =
    fwd.length < MINIMUM_PRIMER_LENGTH || rev.length < MINIMUM_PRIMER_LENGTH

  async function handleSubmit() {
    await query.runQuery({
      fetchFeatures: () =>
        runUcscFetch({
          urlBase,
          buildBody: () =>
            buildIsPcrBody({
              db,
              forwardPrimer: fwd,
              reversePrimer: rev,
              maxProductSize,
              apiKey,
            }),
          parse: parseIsPcrResponse,
          runDirect: () =>
            runIsPcr({
              db,
              forwardPrimer: fwd,
              reversePrimer: rev,
              urlBase,
              maxProductSize,
              apiKey,
            }),
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
            const n = Number(event.target.value)
            if (Number.isFinite(n) && n > 0) {
              setMaxProductSize(n)
            }
          }}
        />
        {tooShort && (fwd || rev) ? (
          <Typography color="error">
            {`Primers must be at least ${MINIMUM_PRIMER_LENGTH} bp`}
          </Typography>
        ) : null}
        {error ? <Typography color="error">{`${error}`}</Typography> : null}
        {challenged ? (
          <Typography>
            The UCSC server requires solving a CAPTCHA. Either paste a UCSC
            apiKey above to avoid it, or click "Solve CAPTCHA", complete it in
            the window that opens, and the search will retry automatically.
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
        {challenged && isElectron ? (
          <Button
            variant="outlined"
            disabled={loading}
            onClick={() => void query.solveChallenge(() => void handleSubmit())}
          >
            Solve CAPTCHA
          </Button>
        ) : null}
        <Button
          variant="contained"
          disabled={loading || tooShort || !db}
          onClick={() => void handleSubmit()}
        >
          {loading ? 'Searching…' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default IsPcrDialog
