import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { setupRunClusteringAutorun } from '@jbrowse/tree-sidebar'

import { parseClusterRegion } from './clusterRegion.ts'
import { runGenotypeClustering } from './runGenotypeClustering.ts'

import type { ReducedModel } from './clusterModelTypes.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The multi-sample-variant "Cluster rows by genotype" flavor of the shared
// declarative-clustering autorun: fires once on `runClustering: true` and runs
// the real genotype-matrix RPC over `clusterRegion` if the session named one,
// or over the current view regions if it did not.
export function getMultiSampleVariantClusterAutorun(
  self: IStateTreeNode &
    ReducedModel & {
      clusteringReady: boolean
      runClustering?: boolean
      clusterRegion?: string
      setRunClustering: (arg?: boolean) => void
      setStatusMessage: (status?: RpcStatus) => void
      makeStatusCallback: () => (status: RpcStatus) => void
    },
) {
  setupRunClusteringAutorun(self, {
    name: 'AutoRunMultiSampleVariantClustering',
    ready: () => self.clusteringReady,
    run: async (view, stopToken, statusCallback) =>
      runGenotypeClustering({
        model: self,
        rpcManager: getSession(self).rpcManager,
        sessionId: getRpcSessionId(self),
        regions: await clusterRegions(self, view),
        stopToken,
        statusCallback,
      }),
  })
}

// The declared locus if there is one, else what is on screen. Resolved here
// rather than in the RPC because the assembly is what turns a locstring into a
// region, and only the client has one.
async function clusterRegions(
  self: IStateTreeNode & { clusterRegion?: string },
  view: LinearGenomeViewModel,
): Promise<Region[]> {
  const { clusterRegion } = self
  const assemblyName = view.assemblyNames[0]
  if (!clusterRegion || !assemblyName) {
    return view.dynamicBlocks.contentBlocks
  }
  // waitForAssembly, not `get`: the autorun can fire on the first ready tick,
  // before the assembly manager has finished loading refNames, and a locstring
  // cannot be validated without them
  const assembly =
    await getSession(self).assemblyManager.waitForAssembly(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  return parseClusterRegion(clusterRegion, assembly, assemblyName)
}
