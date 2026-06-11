import { ErrorMessage } from '@jbrowse/core/ui'
import { Alert } from '@mui/material'

const NETWORK_ERROR_RE =
  /failed to fetch|networkerror|err_internet|err_network|err_name_not_resolved|enotfound|load failed/i

function isNetworkError(error: unknown) {
  return (
    (typeof navigator !== 'undefined' && !navigator.onLine) ||
    NETWORK_ERROR_RE.test(`${error}`)
  )
}

// Shows a friendly offline note for connectivity failures, falling back to the
// normal error display for anything else.
export default function NetworkErrorMessage({ error }: { error: unknown }) {
  return isNetworkError(error) ? (
    <Alert severity="warning">
      You appear to be offline. An internet connection is required to browse
      available genomes.
    </Alert>
  ) : (
    <ErrorMessage error={error} />
  )
}
