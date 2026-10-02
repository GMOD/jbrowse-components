import {
  applyClusterRun,
  clusterProvenanceFromRegions,
} from '@jbrowse/tree-sidebar'

import type { ReducedModel } from './clusterModelTypes.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { RpcMethodCaller } from '@jbrowse/tree-sidebar'

export type ClusterGenotypeMatrixCaller =
  RpcMethodCaller<'MultiSampleVariantClusterGenotypeMatrix'>

// The real "Cluster rows by genotype" -> "Run clustering" RPC, over the genotype
// matrix, extracted so it has one home: the dialog button and a declarative
// session-triggered run (`setupRunClusteringAutorun`, installed in
// setupMultiSampleVariantAutoruns) call the exact same code rather than two
// copies drifting apart.
export async function runGenotypeClustering({
  model,
  rpcManager,
  sessionId,
  regions,
  signal,
  statusCallback,
}: {
  model: ReducedModel
  rpcManager: ClusterGenotypeMatrixCaller
  sessionId: string
  regions: Region[]
  signal: AbortSignal
  statusCallback: (status: RpcStatus) => void
}) {
  const {
    clusterableSources: rows,
    minorAlleleFrequencyFilter,
    maxMissingnessFilter,
    filters,
    adapterConfig,
    renderingMode,
    samplePloidy,
  } = model
  if (!model.sourcesBase) {
    return
  }
  // The rows the display is showing rather than every discovered sample, so
  // with a focus this re-resolves the structure *within* the clade instead of
  // handing back the same whole-cohort tree.
  await applyClusterRun({
    model,
    rows,
    matrix: () =>
      rpcManager.call(sessionId, 'MultiSampleVariantClusterGenotypeMatrix', {
        regions,
        sources: rows,
        minorAlleleFrequencyFilter,
        maxMissingnessFilter,
        filters,
        adapterConfig,
        signal,
        renderingMode,
        samplePloidy,
        partition: model.clusterPartition,
        statusCallback,
      }),
    // The settings recorded are the ones that change which sites entered the
    // matrix. `filters` reduces to whether one was active: the expressions are
    // long and the caption is one line.
    provenance: clusterProvenanceFromRegions(regions, [
      { name: 'mode', value: renderingMode },
      { name: 'MAF filter', value: String(minorAlleleFrequencyFilter) },
      { name: 'max missingness', value: String(maxMissingnessFilter) },
      ...(filters ? [{ name: 'track filters', value: 'active' }] : []),
    ]),
  })
}
