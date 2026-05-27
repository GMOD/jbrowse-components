import { observer } from 'mobx-react'

import ConfigWarningDialog from './ConfigWarningDialog.tsx'
import SessionWarningDialog from './SessionWarningDialog.tsx'
import factoryReset from '../factoryReset.ts'

import type { SessionLoaderModel } from '../SessionLoader.ts'
import type { SessionTriagedInfo } from '../types.ts'

const SessionTriaged = observer(function SessionTriaged({
  sessionTriaged,
  loader,
}: {
  loader: SessionLoaderModel
  sessionTriaged: SessionTriagedInfo
}) {
  return sessionTriaged.origin === 'session' ? (
    <SessionWarningDialog
      onConfirm={async () => {
        await loader.loadDecodedSession(sessionTriaged.snap, true)
        loader.setSessionTriaged(undefined)
      }}
      onCancel={() => {
        loader.setBlankSession(true)
        loader.setSessionTriaged(undefined)
      }}
      reason={sessionTriaged.reason}
    />
  ) : (
    <ConfigWarningDialog
      onConfirm={async () => {
        await loader.applyTriagedConfig(sessionTriaged.snap)
        loader.setSessionTriaged(undefined)
      }}
      onCancel={() => {
        factoryReset()
        loader.setSessionTriaged(undefined)
      }}
      reason={sessionTriaged.reason}
    />
  )
})

export default SessionTriaged
