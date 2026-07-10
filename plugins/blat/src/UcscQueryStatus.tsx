import { isElectron } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { UcscQuery } from './useUcscQuery.ts'

// Error and CAPTCHA-challenge feedback shared by the BLAT and in-silico PCR
// dialogs, driven by the shared query state. The solve-in-a-window affordance
// only exists on desktop, so the browser build points at the apiKey path only.
const UcscQueryStatus = observer(function UcscQueryStatus({
  query,
}: {
  query: UcscQuery
}) {
  const { error, challenged } = query
  return (
    <>
      {error ? <Typography color="error">{`${error}`}</Typography> : null}
      {challenged ? (
        <Typography>
          {isElectron
            ? 'The UCSC server requires solving a CAPTCHA. Either paste a UCSC apiKey above to avoid it, or click "Solve CAPTCHA", complete it in the window that opens, and the search will retry automatically.'
            : 'The UCSC server requires solving a CAPTCHA. Paste a UCSC apiKey above to avoid it.'}
        </Typography>
      ) : null}
    </>
  )
})

export default UcscQueryStatus
