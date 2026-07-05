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
  DEFAULT_BLAT_URL,
  MAXIMUM_BLAT_LENGTH,
  MINIMUM_BLAT_LENGTH,
  buildBlatBody,
  parseBlatResponse,
  runBlat,
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
  const { db, urlBase, apiKey, loading, challenged, error } = query
  const [seq, setSeq] = useState('')

  const cleanSeq = stripFasta(seq)
  const tooShort = cleanSeq.length < MINIMUM_BLAT_LENGTH
  const tooLong = cleanSeq.length > MAXIMUM_BLAT_LENGTH

  async function handleSubmit() {
    await query.runQuery({
      fetchFeatures: () =>
        runUcscFetch({
          urlBase,
          buildBody: () => buildBlatBody({ db, seq: cleanSeq, apiKey }),
          parse: parseBlatResponse,
          runDirect: () => runBlat({ db, seq: cleanSeq, urlBase, apiKey }),
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
        <Typography>
          Paste a DNA sequence to search against the UCSC BLAT server. Results
          are added as a new track. Searches are limited to 25kb.
        </Typography>
        <UcscQueryFields
          session={session}
          query={query}
          urlLabel="BLAT server URL"
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
        {tooShort && cleanSeq ? (
          <Typography color="error">
            {`Sequence must be at least ${MINIMUM_BLAT_LENGTH} bp`}
          </Typography>
        ) : null}
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
            onClick={() => void query.solveChallenge(() => void handleSubmit())}
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
