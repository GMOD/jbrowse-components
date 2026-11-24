import { useEffect } from 'react'

import { invokeIpc } from '../ipc.ts'
import { useIpc } from '../useIpc.ts'
import { handleMcpRequest } from './handleMcpRequest.ts'
import { watchPageErrors } from './pageErrors.ts'

import type { McpReadyState } from '../../electron/ipc/channelTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

// Answers the bridge's mcpRequest pushes against whatever plugin manager is
// installed right now — read per request, not captured, because a session swap
// replaces it (see Loader's installedRef).
export function useMcpRequests(
  getPluginManager: () => PluginManager | undefined,
  phase: McpReadyState['phase'],
  launchError: McpReadyState['launchError'],
  request: McpReadyState['request'],
) {
  // Idempotent, and installed for the app's whole life rather than per session:
  // an error a swap raises belongs to the call that reads next, not to whichever
  // plugin manager happened to be installed when it fired.
  watchPageErrors()

  useIpc('mcpRequest', request => {
    handleMcpRequest(request, getPluginManager(), phase === 'loading')
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
  // would reopen the window this closes. `open` waits for a `phase` carrying
  // its own `request`, so a start screen or an earlier session announcing
  // while its target is still on the way does not answer it. `launchError` is
  // the same news for the route where not even `phase` moves — a pushed launch
  // that throws leaves the previous session on screen.
  useEffect(() => {
    invokeIpc('mcpReady', { phase, launchError, request }).catch(console.error)
  }, [phase, launchError, request])
}
