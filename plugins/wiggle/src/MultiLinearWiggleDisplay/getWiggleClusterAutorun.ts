import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { setupRunClusteringAutorun } from '@jbrowse/tree-sidebar'

import { DEFAULT_SAMPLES_PER_PIXEL } from './components/clusterOptions.ts'
import { runWiggleClustering } from './runWiggleClustering.ts'

import type { ReducedModel } from './clusterModelTypes.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// The multi-wiggle "Cluster columns" flavor of the shared declarative-
// clustering autorun: fires once on `runClustering: true` and runs the real
// score-matrix RPC at the default sampling density (see
// DEFAULT_SAMPLES_PER_PIXEL for why this ignores the dialog's persisted
// preference). Refuses a single row, matching the track menu's gate.
export function getWiggleClusterAutorun(
  self: IAnyStateTreeNode &
    ReducedModel & {
      runClustering?: boolean
      setRunClustering: (arg?: boolean) => void
      setStatusMessage: (status?: RpcStatus) => void
      makeStatusCallback: () => (status: RpcStatus) => void
    },
) {
  setupRunClusteringAutorun(self, {
    name: 'AutoRunMultiWiggleClustering',
    ready: () => self.sourcesWithoutLayout.length > 1,
    run: (_view, stopToken, statusCallback) =>
      runWiggleClustering({
        model: self,
        rpcManager: getSession(self).rpcManager,
        sessionId: getRpcSessionId(self),
        samplesPerPixel: DEFAULT_SAMPLES_PER_PIXEL,
        stopToken,
        statusCallback,
      }),
  })
}
