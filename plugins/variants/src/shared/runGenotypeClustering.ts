import { buildClusteredLayout } from '@jbrowse/tree-sidebar'

import { expandSourcesToHaplotypes } from './getSources.ts'

import type { ReducedModel } from './components/MultiSampleVariantClusterDialog/types.ts'
import type { RpcArgs, RpcReturn } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

type ClusterMethod = 'MultiSampleVariantClusterGenotypeMatrix'

// Narrow structural slice of RpcManager — only the one method this function
// calls, typed straight off the RpcRegistry entry that
// MultiSampleVariantClusterGenotypeMatrix.ts registers (not a hand-duplicated
// shape, so it can't drift from the real RPC method). Kept separate from the
// real RpcManager class — which has private members — so a plain mock object
// can stand in for it in tests without an unsafe cast.
export interface ClusterGenotypeMatrixCaller {
  call: (
    sessionId: string,
    functionName: ClusterMethod,
    args: Omit<RpcArgs<ClusterMethod>, 'sessionId'>,
  ) => Promise<RpcReturn<ClusterMethod>>
}

// The real "Cluster by genotype" -> "Run clustering" RPC, over the genotype
// matrix, extracted so it has one home: the dialog button and a declarative
// session-triggered run (getMultiSampleVariantClusterAutorun) call the exact
// same code rather than two copies drifting apart.
export async function runGenotypeClustering({
  model,
  rpcManager,
  sessionId,
  regions,
  stopToken,
  statusCallback,
}: {
  model: ReducedModel
  rpcManager: ClusterGenotypeMatrixCaller
  sessionId: string
  regions: Region[]
  stopToken: StopToken
  statusCallback: (status: RpcStatus) => void
}) {
  const {
    sourcesVolatile,
    minorAlleleFrequencyFilter,
    maxMissingnessFilter,
    filters,
    adapterConfig,
    renderingMode,
    sampleInfo,
  } = model
  if (sourcesVolatile) {
    const isHaplotypeClustering = renderingMode === 'phased'
    const ret = await rpcManager.call(
      sessionId,
      'MultiSampleVariantClusterGenotypeMatrix',
      {
        regions,
        sources: sourcesVolatile,
        minorAlleleFrequencyFilter: minorAlleleFrequencyFilter ?? 0,
        maxMissingnessFilter: maxMissingnessFilter ?? 1,
        filters,
        adapterConfig,
        stopToken,
        renderingMode,
        sampleInfo,
        statusCallback,
      },
    )
    const baseSources =
      isHaplotypeClustering && sampleInfo
        ? expandSourcesToHaplotypes({ sources: sourcesVolatile, sampleInfo })
        : sourcesVolatile
    model.setLayoutAndPendingClusterTree(
      buildClusteredLayout(baseSources, model.layout, ret.order),
      ret.tree,
    )
  }
}
