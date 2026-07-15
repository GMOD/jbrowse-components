import { isElectron } from '@jbrowse/core/util'
import { Button, DialogActions } from '@mui/material'
import { observer } from 'mobx-react'

import type { UcscQuery } from './useUcscQuery.ts'

// The Cancel / Solve CAPTCHA / Submit footer shared by the BLAT and in-silico
// PCR dialogs. Each dialog supplies its own submit-disabled predicate; the
// challenge-solve affordance only appears on desktop, where a window can be
// opened to clear the Cloudflare Turnstile.
const UcscQueryActions = observer(function UcscQueryActions({
  query,
  submitDisabled,
  onSubmit,
  onCancel,
}: {
  query: UcscQuery
  submitDisabled: boolean
  onSubmit: () => void
  onCancel: () => void
}) {
  const { loading, challenged } = query
  return (
    <DialogActions>
      <Button
        variant="contained"
        onClick={() => {
          onCancel()
        }}
      >
        Cancel
      </Button>
      {challenged && isElectron ? (
        <Button
          variant="outlined"
          disabled={loading}
          onClick={() =>
            void query.solveChallenge(() => {
              onSubmit()
            })
          }
        >
          Solve CAPTCHA
        </Button>
      ) : null}
      <Button
        variant="contained"
        disabled={loading || submitDisabled}
        onClick={() => {
          onSubmit()
        }}
      >
        {loading ? 'Searching…' : 'Submit'}
      </Button>
    </DialogActions>
  )
})

export default UcscQueryActions
