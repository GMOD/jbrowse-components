import { getContainingView, getRpcHost } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { ClusterDialog } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { applyClusterOrder } from '../applyClusterOrder.ts'
import { runGenotypeClustering } from '../runGenotypeClustering.ts'

import type { ReducedModel } from '../clusterModelTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// What "cluster rows by genotype" means for a multi-sample variant display: the
// genotype matrix over the rows on screen. The dialog itself is shared.
const MultiSampleVariantClusterDialog = observer(
  function MultiSampleVariantClusterDialog({
    model,
    handleClose,
  }: {
    model: ReducedModel
    handleClose: () => void
  }) {
    const view = getContainingView(model) as LinearGenomeViewModel
    return (
      <ClusterDialog
        model={model}
        handleClose={handleClose}
        title="Cluster rows by genotype"
        description="This procedure will cluster the visible genotype data using hierarchical clustering"
        matrixLabel="genotype matrix"
        tsvFilename="genotypes.tsv"
        // The same gate the auto path uses (`ready: () => self.clusteringReady`
        // in setupMultiSampleVariantAutoruns), not just "are there sources".
        // In phased mode the haplotype matrix needs `sampleInfo`, which arrives
        // with cellData; running before it builds a sample-level tree whose
        // leaves never match the haplotype rows, so the run appears to do
        // nothing. Reachable while the display is showing "region too large" —
        // this RPC fetches its own regions, so it happily succeeds there.
        canRun={model.clusteringReady}
        matrixKey={model.sourcesBase ? ['genotypeMatrix', model] : null}
        run={async ({ stopToken, statusCallback }) => {
          if (!view.initialized) {
            throw new Error(
              'The view is not initialized yet, please wait and try again',
            )
          }
          await runGenotypeClustering({
            model,
            rpcManager: getRpcHost(model).rpcManager,
            sessionId: getRpcSessionId(model),
            regions: view.dynamicBlocks.contentBlocks,
            stopToken,
            statusCallback,
          })
        }}
        // Same rows the auto path clusters — the ones on screen. Both paths have
        // to agree, or the order pasted back would be indexed against a different
        // sample set than "Run clustering" would have produced.
        fetchMatrix={({ stopToken, statusCallback }) =>
          getRpcHost(model).rpcManager.call(
            getRpcSessionId(model),
            'MultiSampleVariantGetGenotypeMatrix',
            {
              regions: view.dynamicBlocks.contentBlocks,
              sources: model.sourcesBase ?? [],
              minorAlleleFrequencyFilter: model.minorAlleleFrequencyFilter,
              maxMissingnessFilter: model.maxMissingnessFilter,
              filters: model.filters,
              adapterConfig: model.adapterConfig,
              renderingMode: model.renderingMode,
              sampleInfo: model.sampleInfo,
              stopToken,
              statusCallback,
            },
          )
        }
        applyOrder={order => {
          const { sourcesBase, sampleInfo, renderingMode, layout } = model
          if (sourcesBase) {
            model.setLayout(
              applyClusterOrder({
                sourcesBase,
                layout,
                order,
                renderingMode,
                sampleInfo,
              }),
            )
          }
        }}
      />
    )
  },
)

export default MultiSampleVariantClusterDialog
