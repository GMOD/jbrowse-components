import { applyClusterOrder } from './applyClusterOrder.ts'

import type { ReducedModel } from './components/MultiSampleVariantClusterDialog/types.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { RpcMethodCaller } from '@jbrowse/tree-sidebar'

export type ClusterGenotypeMatrixCaller =
  RpcMethodCaller<'MultiSampleVariantClusterGenotypeMatrix'>

// The real "Cluster rows by genotype" -> "Run clustering" RPC, over the genotype
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
    sourcesBase,
    minorAlleleFrequencyFilter,
    maxMissingnessFilter,
    filters,
    adapterConfig,
    renderingMode,
    sampleInfo,
  } = model
  // `sourcesBase` rather than every discovered sample: it is the row set the
  // display is actually showing, so with a subtree filter active this
  // re-resolves the structure *within* the filtered clade instead of handing
  // back the same whole-cohort tree.
  if (sourcesBase) {
    const ret = await rpcManager.call(
      sessionId,
      'MultiSampleVariantClusterGenotypeMatrix',
      {
        regions,
        sources: sourcesBase,
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
    model.setLayoutAndPendingClusterTree(
      applyClusterOrder({
        sourcesBase,
        layout: model.layout,
        order: ret.order,
        renderingMode,
        sampleInfo,
      }),
      ret.tree,
    )
  }
}
