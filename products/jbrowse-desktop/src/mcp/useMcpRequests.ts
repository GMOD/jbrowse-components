import { useEffect } from 'react'

import { invokeIpc } from '../ipc.ts'
import { useIpc } from '../useIpc.ts'
import { handleMcpRequest } from './handleMcpRequest.ts'

import type { McpReadyState } from '../../electron/ipc/channelTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

// Answers the bridge's mcpRequest pushes against whatever plugin manager is
// installed right now — read per request, not captured, because a session swap
// replaces it (see Loader's installedRef).
export function useMcpRequests(
  getPluginManager: () => PluginManager | undefined,
  install: string,
  phase: McpReadyState['phase'],
) {
  useIpc('mcpRequest', request => {
    handleMcpRequest(request, getPluginManager())
      .then(result => invokeIpc('mcpResponse', { id: request.id, result }))
      .catch((e: unknown) => {
        console.error(e)
        return invokeIpc('mcpResponse', {
          id: request.id,
          error: e instanceof Error ? e.message : String(e),
        })
      })
      .catch(console.error)
  })

  // Declared AFTER the subscription above so React runs it second: the bridge
  // treats this as "the listener is live", and announcing before subscribing
  // would reopen the window this closes. It re-fires per installed plugin
  // manager, which is what `open` watches — the session's own id is persisted,
  // so reopening a saved session restores it unchanged and says nothing about
  // whether the load happened. It re-fires on `phase` too: a load that fails
  // installs nothing and so changes no install id, and without this the bridge
  // would wait out its whole open deadline for a session that is not coming.
  useEffect(() => {
    invokeIpc('mcpReady', { install, phase }).catch(console.error)
  }, [install, phase])
}
