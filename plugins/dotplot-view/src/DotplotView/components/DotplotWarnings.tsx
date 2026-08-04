import { Suspense, lazy, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { Alert, Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'
import type { TrackWarning } from './WarningDialog.tsx'

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

  // Read through dotplotDisplays (typed) rather than tracks[i].displays[0]
  // (pluggable, so `any`), and resolve the track name here instead of in the
  // dialog. The name comes off the display's own `parentTrack`, not
  // `tracks[i]`: `dotplotDisplays` filters by display type, so pairing it with
  // `tracks` positionally would label a warning with the wrong track's name the
  // moment the two lists differ in length.
  const rows: TrackWarning[] = model.dotplotDisplays.flatMap(display =>
    display.warnings.length
      ? [
          {
            name: getConf(display.parentTrack, 'name'),
            warnings: display.warnings,
          },
        ]
      : [],
  )
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
