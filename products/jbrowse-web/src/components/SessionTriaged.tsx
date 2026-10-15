import { observer } from 'mobx-react'

import factoryReset from '../factoryReset.ts'
import { rememberPlugins } from '../trustedPlugins.ts'
import PluginWarningDialog from './PluginWarningDialog.tsx'

import type { SessionLoaderModel } from '../SessionLoader.ts'
import type { SessionTriagedInfo } from '../types.ts'

const SessionTriaged = observer(function SessionTriaged({
  sessionTriaged,
  loader,
}: {
  loader: SessionLoaderModel
  sessionTriaged: SessionTriagedInfo
}) {
  const { origin, reason } = sessionTriaged
  return (
    <PluginWarningDialog
      kind={origin}
      reason={reason}
      onConfirm={async remember => {
        if (remember) {
          rememberPlugins(reason)
        }
        await (sessionTriaged.origin === 'session'
          ? loader.acceptTriagedSession(sessionTriaged.snap)
          : loader.applyTriagedConfig(sessionTriaged.snap))
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
