import { observer } from 'mobx-react'

import PluginWarningDialog from './PluginWarningDialog.tsx'
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
    <PluginWarningDialog
      kind="session"
      onConfirm={async () => {
        await loader.loadImportedSession(sessionTriaged.snap, true)
        loader.setSessionTriaged(undefined)
      }}
      onCancel={() => {
        loader.setSessionSource({ type: 'default' })
        loader.setSessionTriaged(undefined)
      }}
      reason={sessionTriaged.reason}
    />
  ) : (
    <PluginWarningDialog
      kind="config"
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
