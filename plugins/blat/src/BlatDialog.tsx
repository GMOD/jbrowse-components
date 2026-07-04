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

import {
  BlatChallengeError,
  DEFAULT_BLAT_URL,
  MAXIMUM_BLAT_LENGTH,
  MINIMUM_BLAT_LENGTH,
  buildBlatBody,
  parseBlatResponse,
  runBlat,
} from './blatQuery.ts'
import { desktopBlatFetch, openBlatChallenge } from './desktopBlat.ts'
import { addResultTrack, resolveUcscDb } from './ucscShared.ts'

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
  const { assemblyNames } = session
  const [assembly, setAssembly] = useState(assemblyNames[0] ?? '')
  const [db, setDb] = useState(() =>
    resolveUcscDb(session, assemblyNames[0] ?? ''),
  )
  const [urlBase, setUrlBase] = useState(DEFAULT_BLAT_URL)
  const [apiKey, setApiKey] = useState('')
  const [seq, setSeq] = useState('')
  const [loading, setLoading] = useState(false)
  const [challenged, setChallenged] = useState(false)
  const [error, setError] = useState<unknown>()

  const cleanSeq = stripFasta(seq)
  const tooShort = cleanSeq.length < MINIMUM_BLAT_LENGTH
  const tooLong = cleanSeq.length > MAXIMUM_BLAT_LENGTH

  // desktop routes through the main process to bypass renderer CORS (so a
  // direct hgBlat call with the user's apiKey works without a proxy); web uses
  // a direct fetch, which needs the server URL to be a CORS-enabled proxy
  async function fetchFeatures() {
    if (isElectron) {
      const { ok, status, text } = await desktopBlatFetch({
        url: urlBase,
        body: buildBlatBody({ db, seq: cleanSeq, apiKey }),
      })
      if (!ok) {
        throw new Error(`BLAT request failed (${status})`)
      }
      return parseBlatResponse(text)
    }
    return runBlat({ db, seq: cleanSeq, urlBase, apiKey })
  }

  async function handleSubmit() {
    setLoading(true)
    setError(undefined)
    setChallenged(false)
    try {
      const features = await fetchFeatures()
      if (!features.length) {
        throw new Error('No BLAT hits found')
      }
      addResultTrack({
        session,
        assembly,
        features,
        trackIdPrefix: 'blat',
        trackName: `BLAT ${new Date().toLocaleTimeString()}`,
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
      title="BLAT search (UCSC)"
      onClose={() => {
        handleClose()
      }}
    >
      <DialogContent
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <Typography>
          Paste a DNA sequence to search against the UCSC BLAT server. Results
          are added as a new track. Searches are limited to 25kb.
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
          helperText="UCSC genome db id BLAT queries against (e.g. hg38)"
        />
        <TextField
          label="BLAT server URL"
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
          label="Sequence"
          value={seq}
          onChange={event => {
            setSeq(event.target.value)
          }}
          multiline
          minRows={5}
          maxRows={12}
          placeholder="Paste DNA sequence or FASTA"
          slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
        />
        {tooLong ? (
          <Typography color="error">
            {`Sequence is ${cleanSeq.length.toLocaleString()} bp; UCSC BLAT is limited to ${MAXIMUM_BLAT_LENGTH.toLocaleString()} bp`}
          </Typography>
        ) : null}
        {error ? <Typography color="error">{`${error}`}</Typography> : null}
        {challenged ? (
          <Typography>
            The UCSC BLAT server requires solving a CAPTCHA. Either paste a UCSC
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
            onClick={() => void handleSolveChallenge()}
          >
            Solve CAPTCHA
          </Button>
        ) : null}
        <Button
          variant="contained"
          disabled={loading || tooShort || tooLong || !db}
          onClick={() => void handleSubmit()}
        >
          {loading ? 'Searching…' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default BlatDialog
