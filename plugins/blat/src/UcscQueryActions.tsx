import { Button, DialogActions } from '@mui/material'
import { observer } from 'mobx-react'

import type { UcscQuery } from './useUcscQuery.ts'

// The Cancel / Submit footer shared by the BLAT and in-silico PCR dialogs. Each
// dialog supplies its own submit-disabled predicate.
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
  const { loading } = query
  return (
    <DialogActions>
      <Button
        variant="contained"
        color="secondary"
        onClick={() => {
          onCancel()
        }}
      >
        Cancel
      </Button>
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
