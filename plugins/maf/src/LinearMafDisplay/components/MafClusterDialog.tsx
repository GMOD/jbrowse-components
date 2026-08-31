import { ClusterDialog } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { clusteredMafLayout, runMafClustering } from '../runMafClustering.ts'

import type { MafClusterSelf } from '../runMafClustering.ts'

// What "cluster rows by identity" means for a MAF display: per-bin identity to
// the reference over the rows on screen, where an unaligned bin scores zero.
// The dialog itself is shared with the other row displays, and `run` is the
// same function the declarative `runClustering` autorun calls.
//
// A MAF track can already have a tree -- the adapter's guide phylogeny -- and
// running this replaces it for as long as the clustered layout stands. That is
// the point rather than a side effect: a guide tree states how the genomes are
// related in general, and clustering states how they differ HERE, which for a
// cohort of one species is the only one of the two that varies by locus.
// "Reset row order" puts the guide tree back.
const MafClusterDialog = observer(function MafClusterDialog({
  model,
  handleClose,
}: {
  model: MafClusterSelf
  handleClose: () => void
}) {
  const sources = model.sources.map(s => s.name)
  return (
    <ClusterDialog
      model={model}
      handleClose={handleClose}
      title="Cluster rows by identity"
      description="This procedure will cluster the visible alignment rows by how much of the window each one aligns and matches at, using hierarchical clustering"
      matrixLabel="identity matrix"
      tsvFilename="identity.tsv"
      // Two rows minimum, the same gate the declarative path uses: one row has
      // nothing to merge with.
      canRun={sources.length > 1}
      matrixKey={sources.length ? ['identityMatrix', model] : null}
      run={args => runMafClustering({ model, ...args })}
      // The same rows the auto path clusters. Both have to agree, or an order
      // pasted back would be indexed against a different row set than
      // "Run clustering" would have produced.
      fetchMatrix={({ rpcManager, sessionId, ...args }) =>
        rpcManager.call(sessionId, 'LinearMafGetIdentityMatrix', {
          sources,
          adapterConfig: model.adapterConfig,
          ...args,
        })
      }
      applyOrder={(order, matrixRowNames) => {
        model.setLayout(
          clusteredMafLayout({
            sources: model.sources,
            editableSources: model.editableSources,
            layout: model.layout,
            order,
            matrixRowNames,
          }),
        )
      }}
    />
  )
})

export default MafClusterDialog
