import { clusterProvenanceFromRegions } from '@jbrowse/tree-sidebar'

import { applyClusterOrder } from './applyClusterOrder.ts'

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
    sampleInfo,
  } = model
  if (!model.sourcesBase) {
    return
  }
  // The rows the display is showing rather than every discovered sample, so
  // with a focus this re-resolves the structure *within* the clade instead of
  // handing back the same whole-cohort tree.
  const ret = await rpcManager.call(
    sessionId,
    'MultiSampleVariantClusterGenotypeMatrix',
    {
      regions,
      sources: rows,
      minorAlleleFrequencyFilter,
      maxMissingnessFilter,
      filters,
      adapterConfig,
      signal,
      renderingMode,
      sampleInfo,
      partition: model.clusterPartition,
      statusCallback,
    },
  )
  // The order and the tree land together, immediately: row order is not a
  // fetch input (see the plugin's CLAUDE.md), so the cells already in hand are
  // placed under the new order the moment it is written.
  const arranged = applyClusterOrder({
    rows,
    arranged: model.editableSources,
    order: ret.order,
    tree: ret.tree,
    domain: model.rowDomain,
  })
  model.setRowOrder(arranged.order, {
    tree: arranged.tree,
    // The settings recorded are the ones that change which sites entered the
    // matrix, so a reader can tell a tree built over common variants from one
    // built over everything. `filters` (a jexl chain) is deliberately reduced
    // to whether one was active: the expressions are long, the caption is one
    // line, and "there was a filter" is what changes how the tree should be
    // read.
    provenance: clusterProvenanceFromRegions(regions, [
      { name: 'mode', value: renderingMode },
      { name: 'MAF filter', value: String(minorAlleleFrequencyFilter) },
      { name: 'max missingness', value: String(maxMissingnessFilter) },
      ...(filters ? [{ name: 'track filters', value: 'active' }] : []),
    ]),
  })
}
