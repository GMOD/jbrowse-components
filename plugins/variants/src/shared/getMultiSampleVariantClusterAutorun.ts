import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { setupRunClusteringAutorun } from '@jbrowse/tree-sidebar'

import { runGenotypeClustering } from './runGenotypeClustering.ts'

import type { ReducedModel } from './components/MultiSampleVariantClusterDialog/types.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// The multi-sample-variant "Cluster by genotype" flavor of the shared
// declarative-clustering autorun: fires once on `runClustering: true` and runs
// the real genotype-matrix RPC over the current view regions.
export function getMultiSampleVariantClusterAutorun(
  self: IAnyStateTreeNode &
    ReducedModel & {
      runClustering?: boolean
      setRunClustering: (arg?: boolean) => void
      setStatusMessage: (status?: RpcStatus) => void
    },
) {
  setupRunClusteringAutorun(self, {
    name: 'AutoRunMultiSampleVariantClustering',
    ready: () => !!self.sourcesVolatile,
    run: (view, stopToken) =>
      runGenotypeClustering({
        model: self,
        rpcManager: getSession(self).rpcManager,
        sessionId: getRpcSessionId(self),
        regions: view.dynamicBlocks.contentBlocks,
        stopToken,
        statusCallback: self.setStatusMessage,
      }),
  })
}
