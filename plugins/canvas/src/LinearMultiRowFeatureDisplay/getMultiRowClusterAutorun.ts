import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { setupRunClusteringAutorun } from '@jbrowse/tree-sidebar'

import { runMultiRowClustering } from './runMultiRowClustering.ts'

import type { MultiRowClusterModel } from './runMultiRowClustering.ts'

// The multi-row "Cluster rows by similarity" flavor of the shared declarative-
// clustering autorun: fires once when `runClustering` flips true (from the
// track menu or a saved session) and runs the real feature-matrix RPC, then
// clears the flag.
export function getMultiRowClusterAutorun(
  self: MultiRowClusterModel & {
    runClustering?: boolean
    setRunClustering: (arg?: boolean) => void
  },
) {
  setupRunClusteringAutorun(self, {
    name: 'AutoRunMultiRowClustering',
    ready: () => self.sourcesWithoutLayout.length > 1,
    run: (view, stopToken) =>
      runMultiRowClustering({
        model: self,
        view,
        rpcManager: getSession(self).rpcManager,
        sessionId: getRpcSessionId(self),
        stopToken,
        statusCallback: () => {},
      }),
  })
}
