import { Suspense, useState } from 'react'

import { ConnectAgentDialog } from '@jbrowse/app-core'
import { observer } from 'mobx-react'

import { useIpc } from '../useIpc.ts'
import { desktopAgentRoutes } from './desktopAgentRoutes.tsx'

import type { ConnectAgentSetup } from '../../electron/ipc/channelTypes.ts'

const ConnectAgentHost = observer(function ConnectAgentHost() {
  const [setup, setSetup] = useState<ConnectAgentSetup>()
  useIpc('connectAgentSetup', s => {
    setSetup(s)
  })
  return setup ? (
    <Suspense fallback={null}>
      <ConnectAgentDialog
        routes={desktopAgentRoutes(setup)}
        onClose={() => {
          setSetup(undefined)
        }}
      />
    </Suspense>
  ) : null
})

export default ConnectAgentHost
