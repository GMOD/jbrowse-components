import { useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Alert, Button, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { looksLikeUcscDb } from './ucscDbMap.ts'
import { ucscDbStamp } from './ucscShared.ts'

import type { UcscHost } from './ucscShared.ts'
import type { UcscQuery } from './useUcscQuery.ts'

// The UCSC connection fields shared by the BLAT and in-silico PCR dialogs. The
// assembly picker is the only thing most users touch, so it stays visible; the
// resolved db id, server URL, and apiKey collapse behind a toggle.
const UcscQueryFields = observer(function UcscQueryFields({
  session,
  query,
  urlLabel,
}: {
  session: UcscHost
  query: UcscQuery
  urlLabel: string
}) {
  const { assembly, db, urlBase, apiKey } = query
  const [showAdvanced, setShowAdvanced] = useState(false)
  // the query is only as good as the db behind it, and nothing about a locally
  // opened genome says UCSC has never heard of it until the request comes back
  const searchable = !!ucscDbStamp(session, assembly) || looksLikeUcscDb(db)
  return (
    <>
      {/* Sized to itself rather than stretched across the dialog. Both dialogs
          lay their content out as a flex column, whose default `stretch` runs
          a one-word select the full `maxWidth="md"`, beside a 200px "Max
          product size" and a left-aligned advanced-settings button, which is
          how it read as a mistake. The primer pair is the only row that wants
          the whole width. */}
      <div style={{ alignSelf: 'flex-start', minWidth: 260 }}>
        <AssemblySelector
          session={session}
          selected={assembly}
          onChange={arg => {
            query.changeAssembly(arg)
          }}
          fullWidth
        />
      </div>
      {searchable ? null : (
        <Alert severity="warning">
          {`${assembly} has no UCSC database, so this would search "${db}". A genome opened from your own files is not hosted at UCSC; set the database under advanced settings if one exists.`}
        </Alert>
      )}
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
