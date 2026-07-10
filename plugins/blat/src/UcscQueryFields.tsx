import { useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { isElectron } from '@jbrowse/core/util'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Alert, Button, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { UcscQuery } from './useUcscQuery.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// The UCSC connection fields shared by the BLAT and in-silico PCR dialogs. The
// assembly picker is the only thing most users touch, so it stays visible; the
// resolved db id, server URL, apiKey, and CAPTCHA note collapse behind a
// toggle.
const UcscQueryFields = observer(function UcscQueryFields({
  session,
  query,
  urlLabel,
}: {
  session: AbstractSessionModel
  query: UcscQuery
  urlLabel: string
}) {
  const { assembly, db, urlBase, apiKey } = query
  const [showAdvanced, setShowAdvanced] = useState(false)
  return (
    <>
      <AssemblySelector
        session={session}
        selected={assembly}
        onChange={arg => {
          query.changeAssembly(arg)
        }}
      />
      <Button
        size="small"
        style={{ alignSelf: 'flex-start' }}
        startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => {
          setShowAdvanced(!showAdvanced)
        }}
      >
        {showAdvanced ? 'Hide' : 'Show'} advanced settings
      </Button>
      {showAdvanced ? (
        <>
          <Alert severity="info">
            {isElectron
              ? 'UCSC fronts BLAT and in-silico PCR with a Cloudflare Turnstile CAPTCHA. Enter a UCSC apiKey to skip it; otherwise you will be asked to solve it in a popup window.'
              : 'UCSC fronts BLAT and in-silico PCR with a Cloudflare Turnstile CAPTCHA. Enter a UCSC apiKey, or point the server URL at a proxy that injects one, to avoid it.'}
          </Alert>
          <TextField
            label="UCSC database"
            value={db}
            onChange={event => {
              query.setDb(event.target.value)
            }}
            helperText="UCSC db or GenArk accession to query (e.g. hg38 or GCF_000001405.40)"
          />
          <TextField
            label={urlLabel}
            value={urlBase}
            onChange={event => {
              query.setUrlBase(event.target.value)
            }}
            helperText="Point at a mirror or self-hosted proxy if the default is unavailable"
          />
          <TextField
            label="UCSC apiKey (optional)"
            value={apiKey}
            onChange={event => {
              query.changeApiKey(event.target.value)
            }}
            helperText="Bypasses the UCSC CAPTCHA. Generate one at a UCSC Genome Browser account → Hub Development → API key. Not needed when the server URL is a proxy that injects a key."
          />
        </>
      ) : null}
    </>
  )
})

export default UcscQueryFields
