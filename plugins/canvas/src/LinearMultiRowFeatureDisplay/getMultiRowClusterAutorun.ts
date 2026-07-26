import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { setupRunClusteringAutorun } from '@jbrowse/tree-sidebar'

import { runMultiRowClustering } from './runMultiRowClustering.ts'

import type { MultiRowClusterModel } from './runMultiRowClustering.ts'
import type { RpcStatus } from '@jbrowse/core/util'

// The multi-row "Cluster rows by similarity" flavor of the shared declarative-
// clustering autorun: fires once when `runClustering` flips true (from the
// track menu or a saved session) and runs the real feature-matrix RPC, then
// clears the flag.
export function getMultiRowClusterAutorun(
  self: MultiRowClusterModel & {
    runClustering?: boolean
    setRunClustering: (arg?: boolean) => void
    setStatusMessage: (status?: RpcStatus) => void
    makeStatusCallback: () => (status: RpcStatus) => void
  },
) {
  setupRunClusteringAutorun(self, {
    name: 'AutoRunMultiRowClustering',
    ready: () => self.sourcesWithoutLayout.length > 1,
    run: (view, stopToken, statusCallback) =>
      runMultiRowClustering({
        model: self,
        view,
        rpcManager: getSession(self).rpcManager,
        sessionId: getRpcSessionId(self),
        stopToken,
        statusCallback,
      }),
  })
}
