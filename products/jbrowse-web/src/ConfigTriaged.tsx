import React, { lazy, Suspense } from 'react'
import shortid from 'shortid'
import clone from 'clone'

// locals
import { SessionLoaderModel } from './SessionLoader'
import factoryReset from './factoryReset'

const ConfigWarningDialog = lazy(() => import('./ConfigWarningDialog'))

export default function ConfigTriaged({
  loader,
  handleClose,
}: {
  loader: SessionLoaderModel
  handleClose: () => void
}) {
  return (
    <Suspense fallback={<div />}>
      <ConfigWarningDialog
        onConfirm={async () => {
          const session = clone(loader.sessionTriaged.snap)
          await loader.fetchPlugins(session)
          loader.setConfigSnapshot({ ...session, id: shortid() })
          handleClose()
        }}
        onCancel={async () => {
          await factoryReset()
          handleClose()
        }}
        reason={loader.sessionTriaged.reason}
      />
    </Suspense>
  )
}
