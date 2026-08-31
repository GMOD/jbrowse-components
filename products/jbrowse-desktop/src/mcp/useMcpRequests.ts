import { invokeIpc } from '../ipc.ts'
import { useIpc } from '../useIpc.ts'
import { handleMcpRequest } from './handleMcpRequest.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// Answers the bridge's mcpRequest pushes against whatever plugin manager is
// installed right now — read per request, not captured, because a session swap
// replaces it (see Loader's installedRef).
export function useMcpRequests(
  getPluginManager: () => PluginManager | undefined,
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
}
