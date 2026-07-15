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
  const { origin, snap, reason } = sessionTriaged
  return (
    <PluginWarningDialog
      kind={origin}
      reason={reason}
      onConfirm={async () => {
        if (origin === 'session') {
          await loader.loadImportedSession(snap, true)
          loader.setSessionTriaged(undefined)
        } else {
          // applyTriagedConfig clears the config triage and resolves the
          // session itself, which may surface a new (session) triage
          await loader.applyTriagedConfig(snap)
        }
      }}
      onCancel={() => {
        if (origin === 'session') {
          loader.setSessionSource({ type: 'default' })
          loader.setSessionTriaged(undefined)
        } else {
          // factoryReset() navigates the page away, so there's nothing to clear
          factoryReset()
        }
      }}
    />
  )
})

export default SessionTriaged
