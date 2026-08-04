import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { setupRunClusteringAutorun } from '@jbrowse/tree-sidebar'

import { runGenotypeClustering } from './runGenotypeClustering.ts'

import type { ReducedModel } from './clusterModelTypes.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// The multi-sample-variant "Cluster rows by genotype" flavor of the shared
// declarative-clustering autorun: fires once on `runClustering: true` and runs
// the real genotype-matrix RPC over the current view regions.
export function getMultiSampleVariantClusterAutorun(
  self: IStateTreeNode &
    ReducedModel & {
      clusteringReady: boolean
      runClustering?: boolean
      setRunClustering: (arg?: boolean) => void
      setStatusMessage: (status?: RpcStatus) => void
      makeStatusCallback: () => (status: RpcStatus) => void
    },
) {
  setupRunClusteringAutorun(self, {
    name: 'AutoRunMultiSampleVariantClustering',
    ready: () => self.clusteringReady,
    run: (view, stopToken, statusCallback) =>
      runGenotypeClustering({
        model: self,
        rpcManager: getSession(self).rpcManager,
        sessionId: getRpcSessionId(self),
        regions: view.dynamicBlocks.contentBlocks,
        stopToken,
        statusCallback,
      }),
  })
}
