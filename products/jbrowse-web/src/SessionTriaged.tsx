import React, { lazy, Suspense } from 'react'
import shortid from 'shortid'

// locals
import { SessionLoaderModel } from './SessionLoader'
import clone from 'clone'

// lazy components
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
          const session = clone(loader.sessionTriaged.snap)
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
