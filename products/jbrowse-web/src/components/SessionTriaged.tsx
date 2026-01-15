import { createElementId } from '@jbrowse/core/util/types/mst'
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
        const session = JSON.parse(JSON.stringify(sessionTriaged.snap))

        // second param true says we passed user confirmation
        await loader.loadSession({ ...session, id: createElementId() }, true)
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
        const session = JSON.parse(JSON.stringify(sessionTriaged.snap))
        await loader.fetchPlugins(session)
        loader.setConfigSnapshot({ ...session, id: createElementId() })
        loader.setSessionTriaged(undefined)
      }}
      onCancel={async () => {
        await factoryReset()
        loader.setSessionTriaged(undefined)
      }}
      reason={sessionTriaged.reason}
    />
  )
})

export default SessionTriaged
