import { useState } from 'react'

import { AssemblySelector, Dialog } from '@jbrowse/core/ui'
import { isElectron, isSessionWithAddTracks } from '@jbrowse/core/util'
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
  MINIMUM_BLAT_LENGTH,
  buildBlatBody,
  parseBlatResponse,
  runBlat,
} from './blatQuery.ts'
import { desktopBlatFetch, openBlatChallenge } from './desktopBlat.ts'
import { assemblyToUcscDb } from './ucscDbMap.ts'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'

interface ViewWithTracks {
  type: string
  assemblyNames?: string[]
  showTrack?: (trackId: string) => void
}

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
  const [db, setDb] = useState(() => assemblyToUcscDb(assemblyNames[0] ?? ''))
  const [urlBase, setUrlBase] = useState(DEFAULT_BLAT_URL)
  const [seq, setSeq] = useState('')
  const [loading, setLoading] = useState(false)
  const [challenged, setChallenged] = useState(false)
  const [error, setError] = useState<unknown>()

  const cleanSeq = stripFasta(seq)
  const tooShort = cleanSeq.length < MINIMUM_BLAT_LENGTH

  // desktop routes through the main process so a solved-challenge cookie
  // attaches first-party; web uses a direct fetch
  async function fetchFeatures() {
    if (isElectron) {
      const { ok, status, text } = await desktopBlatFetch({
        url: urlBase,
        body: buildBlatBody({ db, seq: cleanSeq }),
      })
      if (!ok) {
        throw new Error(`BLAT request failed (${status})`)
      }
      return parseBlatResponse(text)
    }
    return runBlat({ db, seq: cleanSeq, urlBase })
  }

  function addResultTrack(features: SimpleFeatureSerialized[]) {
    if (!isSessionWithAddTracks(session)) {
      throw new Error("Can't add tracks to this session")
    }
    const trackId = `blat-${Date.now()}`
    session.addTrackConf({
      type: 'FeatureTrack',
      trackId,
      name: `BLAT ${new Date().toLocaleTimeString()}`,
      assemblyNames: [assembly],
      adapter: {
        type: 'FromConfigAdapter',
        features,
      },
    })
    const view = session.views.find(
      (v): v is typeof v & ViewWithTracks =>
        (v as ViewWithTracks).type === 'LinearGenomeView' &&
        !!(v as ViewWithTracks).assemblyNames?.includes(assembly),
    )
    view?.showTrack?.(trackId)
    if (!view) {
      session.notify(
        `Added track "${trackId}" but no open view displays ${assembly}`,
        'warning',
      )
    }
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
      addResultTrack(features)
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
            setDb(assemblyToUcscDb(arg))
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
          helperText="Point at a mirror or self-hosted server if the default is unavailable"
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
        {error ? <Typography color="error">{`${error}`}</Typography> : null}
        {challenged ? (
          <Typography>
            The UCSC BLAT server requires solving a CAPTCHA. Click "Solve
            CAPTCHA", complete it in the window that opens, and the search will
            retry automatically.
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

export default BlatDialog
