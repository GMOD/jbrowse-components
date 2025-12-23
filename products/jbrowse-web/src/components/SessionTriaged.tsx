import { nanoid } from '@jbrowse/core/util/nanoid'
import { observer } from 'mobx-react'

import ConfigWarningDialog from './ConfigWarningDialog'
import SessionWarningDialog from './SessionWarningDialog'
import factoryReset from '../factoryReset'

import type { SessionLoaderModel } from '../SessionLoader'
import type { SessionTriagedInfo } from '../types'

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
        await loader.loadSession({ ...session, id: nanoid() }, true)
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
        loader.setConfigSnapshot({ ...session, id: nanoid() })
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
