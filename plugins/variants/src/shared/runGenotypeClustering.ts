import { clusterProvenanceFromRegions } from '@jbrowse/tree-sidebar'

import { applyClusterOrder } from './applyClusterOrder.ts'

import type { ReducedModel } from './clusterModelTypes.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
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
        minorAlleleFrequencyFilter,
        maxMissingnessFilter,
        filters,
        adapterConfig,
        stopToken,
        renderingMode,
        sampleInfo,
        statusCallback,
      },
    )
    // Layout and tree land together, immediately. They used to be split, with
    // the tree held until the next cellData arrived, because `layout` was an
    // RPC input: a clustering run refetched, and during that window the cells
    // on screen were still in the old order while the tree already showed the
    // new one. Row order is not a fetch input any more (see the plugin's
    // CLAUDE.md) — the worker names its rows and `rowRemap` places them onto
    // screen rows, re-derived from `sources` the moment `layout` changes — so
    // there is no window left to defer across. Deferring anyway meant the tree
    // waited on a refetch that no longer happens, and a
    // `runClustering: true` display drew no dendrogram at all.
    model.setLayoutAndClusterTree(
      applyClusterOrder({
        sourcesBase,
        layout: model.layout,
        order: ret.order,
        renderingMode,
        sampleInfo,
      }),
      ret.tree,
      // The settings recorded are the ones that change which sites entered the
      // matrix, so a reader can tell a tree built over common variants from one
      // built over everything. `filters` (a jexl chain) is deliberately reduced
      // to whether one was active: the expressions are long, the caption is one
      // line, and "there was a filter" is what changes how the tree should be
      // read.
      clusterProvenanceFromRegions(regions, [
        { name: 'mode', value: renderingMode },
        { name: 'MAF filter', value: String(minorAlleleFrequencyFilter) },
        { name: 'max missingness', value: String(maxMissingnessFilter) },
        ...(filters ? [{ name: 'track filters', value: 'active' }] : []),
      ]),
    )
  }
}
