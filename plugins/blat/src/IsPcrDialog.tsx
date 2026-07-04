import { useState } from 'react'

import { AssemblySelector, Dialog } from '@jbrowse/core/ui'
import { isElectron } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { BlatChallengeError } from './blatQuery.ts'
import { desktopBlatFetch, openBlatChallenge } from './desktopBlat.ts'
import {
  DEFAULT_ISPCR_URL,
  DEFAULT_MAX_PRODUCT_SIZE,
  MINIMUM_PRIMER_LENGTH,
  buildIsPcrBody,
  parseIsPcrResponse,
  runIsPcr,
} from './ispcrQuery.ts'
import { addResultTrack, resolveUcscDb } from './ucscShared.ts'

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
  const { assemblyNames } = session
  const [assembly, setAssembly] = useState(assemblyNames[0] ?? '')
  const [db, setDb] = useState(() =>
    resolveUcscDb(session, assemblyNames[0] ?? ''),
  )
  const [urlBase, setUrlBase] = useState(DEFAULT_ISPCR_URL)
  const [apiKey, setApiKey] = useState('')
  const [forwardPrimer, setForwardPrimer] = useState('')
  const [reversePrimer, setReversePrimer] = useState('')
  const [maxProductSize, setMaxProductSize] = useState(DEFAULT_MAX_PRODUCT_SIZE)
  const [loading, setLoading] = useState(false)
  const [challenged, setChallenged] = useState(false)
  const [error, setError] = useState<unknown>()

  const fwd = cleanPrimer(forwardPrimer)
  const rev = cleanPrimer(reversePrimer)
  const tooShort =
    fwd.length < MINIMUM_PRIMER_LENGTH || rev.length < MINIMUM_PRIMER_LENGTH

  async function fetchFeatures() {
    if (isElectron) {
      const { ok, status, text } = await desktopBlatFetch({
        url: urlBase,
        body: buildIsPcrBody({
          db,
          forwardPrimer: fwd,
          reversePrimer: rev,
          maxProductSize,
          apiKey,
        }),
      })
      if (!ok) {
        throw new Error(`hgPcr request failed (${status})`)
      }
      return parseIsPcrResponse(text)
    }
    return runIsPcr({
      db,
      forwardPrimer: fwd,
      reversePrimer: rev,
      urlBase,
      maxProductSize,
      apiKey,
    })
  }

  async function handleSubmit() {
    setLoading(true)
    setError(undefined)
    setChallenged(false)
    try {
      const features = await fetchFeatures()
      if (!features.length) {
        throw new Error('No PCR products found')
      }
      addResultTrack({
        session,
        assembly,
        features,
        trackIdPrefix: 'ispcr',
        trackName: `In-silico PCR ${new Date().toLocaleTimeString()}`,
      })
      handleClose()
    } catch (e) {
      console.error(e)
      if (e instanceof BlatChallengeError) {
        setChallenged(true)
      }
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSolveChallenge() {
    const solved = await openBlatChallenge(urlBase)
    if (solved) {
      await handleSubmit()
    } else {
      session.notify('CAPTCHA window closed before it was solved', 'warning')
    }
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
        <AssemblySelector
          session={session}
          selected={assembly}
          onChange={arg => {
            setAssembly(arg)
            setDb(resolveUcscDb(session, arg))
          }}
        />
        <TextField
          label="UCSC database"
          value={db}
          onChange={event => {
            setDb(event.target.value)
          }}
          helperText="UCSC genome db id to query against (e.g. hg38)"
        />
        <TextField
          label="In-silico PCR server URL"
          value={urlBase}
          onChange={event => {
            setUrlBase(event.target.value)
          }}
          helperText="Point at a mirror or self-hosted proxy if the default is unavailable"
        />
        <TextField
          label="UCSC apiKey (optional)"
          value={apiKey}
          onChange={event => {
            setApiKey(event.target.value)
          }}
          helperText="Bypasses the UCSC CAPTCHA. Generate one at a UCSC Genome Browser account → Hub Development → API key. Not needed when the server URL is a proxy that injects a key."
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
            onClick={() => void handleSolveChallenge()}
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
