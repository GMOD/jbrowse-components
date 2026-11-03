import { ErrorMessage } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { UcscQuery } from './useUcscQuery.ts'

// Wait, empty-result and error feedback shared by the BLAT and in-silico PCR
// dialogs, driven by the shared query state.
const UcscQueryStatus = observer(function UcscQueryStatus({
  query,
}: {
  query: UcscQuery
}) {
  const { error, notFound, slotWait } = query
  return (
    <>
      {slotWait ? (
        <Typography color="textSecondary">
          {`Another search is using the shared BLAT server, which takes one query at a time. Retrying in ${slotWait} s…`}
        </Typography>
      ) : null}
      {notFound ? (
        <Typography color="textSecondary">{notFound}</Typography>
      ) : null}
      {error ? <ErrorMessage error={error} /> : null}
    </>
  )
})

export default UcscQueryStatus
