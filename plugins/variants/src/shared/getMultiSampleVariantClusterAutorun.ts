import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { setupRunClusteringAutorun } from '@jbrowse/tree-sidebar'

import { runGenotypeClustering } from './runGenotypeClustering.ts'

import type { ReducedModel } from './clusterModelTypes.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// The multi-sample-variant "Cluster rows by genotype" flavor of the shared
// declarative-clustering autorun: fires once on `runClustering: true` and runs
// the real genotype-matrix RPC over whatever the autorun resolved -- the
// `clusterRegion` locus if the session named one, the visible blocks if not.
export function getMultiSampleVariantClusterAutorun(
  self: IStateTreeNode &
    ReducedModel & {
      clusteringReady: boolean
      runClustering?: boolean
      clusterRegion?: string
      setRunClustering: (arg?: boolean) => void
      setClusterRegion: (arg?: string) => void
      setStatusMessage: (status?: RpcStatus) => void
      makeStatusCallback: () => (status: RpcStatus) => void
    },
) {
  setupRunClusteringAutorun(self, {
    name: 'AutoRunMultiSampleVariantClustering',
    ready: () => self.clusteringReady,
    run: (view, stopToken, statusCallback, regions) =>
      runGenotypeClustering({
        model: self,
        rpcManager: getSession(self).rpcManager,
        sessionId: getRpcSessionId(self),
        regions,
        stopToken,
        statusCallback,
      }),
  })
}
