import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { setupRunClusteringAutorun } from '@jbrowse/tree-sidebar'

import { runMultiRowClustering } from './runMultiRowClustering.ts'

import type { MultiRowClusterModel } from './runMultiRowClustering.ts'
import type { RpcStatus } from '@jbrowse/core/util'

// The multi-row "Cluster rows by similarity" flavor of the shared declarative-
// clustering autorun: fires once when `runClustering` flips true (from the
// track menu or a saved session) and runs the real feature-matrix RPC over
// whatever the autorun resolved -- the `clusterRegion` locus if the session
// named one, the visible blocks if not -- then clears the flag.
export function getMultiRowClusterAutorun(
  self: MultiRowClusterModel & {
    runClustering?: boolean
    clusterRegion?: string
    setRunClustering: (arg?: boolean) => void
    setClusterRegion: (arg?: string) => void
    setStatusMessage: (status?: RpcStatus) => void
    makeStatusCallback: () => (status: RpcStatus) => void
  },
) {
  setupRunClusteringAutorun(self, {
    name: 'AutoRunMultiRowClustering',
    ready: () => self.sourcesWithoutLayout.length > 1,
    run: (_view, stopToken, statusCallback, regions) =>
      runMultiRowClustering({
        model: self,
        regions,
        rpcManager: getSession(self).rpcManager,
        sessionId: getRpcSessionId(self),
        stopToken,
        statusCallback,
      }),
  })
}
