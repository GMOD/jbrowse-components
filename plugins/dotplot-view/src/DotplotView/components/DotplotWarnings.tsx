import React, { lazy, useState } from 'react'
import { Alert, Button } from '@mui/material'
import { observer } from 'mobx-react'

// locals
import type { DotplotViewModel } from '../model'
// lazy components
const WarningDialog = lazy(() => import('./WarningDialog'))

const DotplotWarnings = observer(function ({
  model,
}: {
  model: DotplotViewModel
}) {
  const trackWarnings = model.tracks.filter(t => t.displays[0].warnings?.length)
  const [shown, setShown] = useState(false)
  const [hide, setHide] = useState(false)
  return trackWarnings.length && !hide ? (
    <Alert severity="warning">
      Warnings during render{' '}
      <Button
        onClick={() => {
          setShown(true)
        }}
      >
        More info
      </Button>
      {shown ? (
        <WarningDialog
          trackWarnings={trackWarnings}
          handleClose={() => {
            setShown(false)
          }}
        />
      ) : null}
      <Button
        variant="contained"
        onClick={() => {
          setHide(true)
        }}
      >
        Dismiss
      </Button>
    </Alert>
  ) : null
})

export default DotplotWarnings
