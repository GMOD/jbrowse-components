import { AssemblySelector } from '@jbrowse/core/ui'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { UcscQuery } from './useUcscQuery.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// The UCSC connection fields shared by the BLAT and in-silico PCR dialogs:
// assembly picker, resolved db id, server URL, and optional apiKey.
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
  return (
    <>
      <AssemblySelector
        session={session}
        selected={assembly}
        onChange={arg => {
          query.changeAssembly(arg)
        }}
      />
      <TextField
        label="UCSC database"
        value={db}
        onChange={event => {
          query.setDb(event.target.value)
        }}
        helperText="UCSC genome db id to query against (e.g. hg38)"
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
          query.setApiKey(event.target.value)
        }}
        helperText="Bypasses the UCSC CAPTCHA. Generate one at a UCSC Genome Browser account → Hub Development → API key. Not needed when the server URL is a proxy that injects a key."
      />
    </>
  )
})

export default UcscQueryFields
