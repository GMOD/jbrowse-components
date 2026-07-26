import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { setupRunClusteringAutorun } from '@jbrowse/tree-sidebar'

import { runWiggleClustering } from './runWiggleClustering.ts'
import { DEFAULT_SAMPLES_PER_PIXEL } from './components/WiggleClusterDialog/clusterOptions.ts'

import type { ReducedModel } from './components/WiggleClusterDialog/types.ts'
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
    },
) {
  setupRunClusteringAutorun(self, {
    name: 'AutoRunMultiWiggleClustering',
    ready: () => self.sourcesWithoutLayout.length > 1,
    run: (_view, stopToken) =>
      runWiggleClustering({
        model: self,
        rpcManager: getSession(self).rpcManager,
        sessionId: getRpcSessionId(self),
        samplesPerPixel: DEFAULT_SAMPLES_PER_PIXEL,
        stopToken,
        statusCallback: () => {},
      }),
  })
}
