import React, { lazy, useState } from 'react'
import { Alert, Button } from '@mui/material'
import { observer } from 'mobx-react'

// locals
import { DotplotViewModel } from '../model'

// lazy components
const WarningDialog = lazy(() => import('./WarningDialog'))

export default observer(function ({ model }: { model: DotplotViewModel }) {
  const trackWarnings = model.tracks.filter(t => t.displays[0].warnings?.length)
  const [shown, setShown] = useState(false)
  return trackWarnings.length ? (
    <Alert severity="warning">
      Warnings during render{' '}
      <Button onClick={() => setShown(true)}>More info</Button>
      {shown ? (
        <WarningDialog
          trackWarnings={trackWarnings}
          handleClose={() => setShown(false)}
        />
      ) : null}
    </Alert>
  ) : null
})
