import React, { Suspense, lazy } from 'react'
import shortid from 'shortid'

import { SessionLoaderModel } from '../SessionLoader'

const SessionWarningDialog = lazy(() => import('./SessionWarningDialog'))

export default function SessionTriaged({
  loader,
  handleClose,
}: {
  loader: SessionLoaderModel
  handleClose: Function
}) {
  return (
    <Suspense fallback={<div />}>
      <SessionWarningDialog
        onConfirm={async () => {
          const session = JSON.parse(JSON.stringify(loader.sessionTriaged.snap))

          // second param true says we passed user confirmation
          await loader.setSessionSnapshot({ ...session, id: shortid() }, true)
          handleClose()
        }}
        onCancel={() => {
          loader.setBlankSession(true)
          handleClose()
        }}
        reason={loader.sessionTriaged.reason}
      />
    </Suspense>
  )
}
