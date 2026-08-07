import { Suspense, lazy, useState } from 'react'

import { Alert, Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

// lazy components
const WarningDialog = lazy(() => import('./WarningDialog.tsx'))

const DotplotWarnings = observer(function DotplotWarnings({
  model,
}: {
  model: DotplotViewModel
}) {
  const [shown, setShown] = useState(false)
  // Dismissal is keyed on the warning text, not on how many tracks have
  // warnings: a count only rises, so dismissing one warning used to suppress
  // every later one that arrived at the same count — including a genuinely
  // different message on the same track after a refetch.
  const [dismissedKey, setDismissedKey] = useState<string>()

  // Resolved on the model (`trackWarnings`), where it is cached and where the
  // "read through dotplotDisplays, never tracks[i]" rule lives with the list it
  // is about.
  const rows = model.trackWarnings
  const warningKey = rows.flatMap(r => r.warnings.map(w => w.message)).join('|')

  return warningKey && warningKey !== dismissedKey ? (
    <Alert severity="warning">
      Warnings during render{' '}
      <Button
        variant="contained"
        onClick={() => {
          setShown(true)
        }}
      >
        More info
      </Button>
      {shown ? (
        <Suspense fallback={null}>
          <WarningDialog
            trackWarnings={rows}
            handleClose={() => {
              setShown(false)
            }}
          />
        </Suspense>
      ) : null}
      <Button
        variant="contained"
        onClick={() => {
          setDismissedKey(warningKey)
        }}
      >
        Dismiss
      </Button>
    </Alert>
  ) : null
})

export default DotplotWarnings
