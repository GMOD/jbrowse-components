import { ClusterDialog, clusteredCladeLayout } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { runMafClustering } from '../runMafClustering.ts'

import type { MafClusterSelf } from '../runMafClustering.ts'

// What "cluster rows by identity" means for a MAF display: per-bin identity to
// the reference over the focused rows, a hidden reference row among them so
// its leaf is in the tree when it shows again, where an unaligned bin scores zero.
// `run` is the function the declarative `runClustering` autorun calls.
// Running replaces the guide tree until "Reset row order" puts it back: the
// guide tree states how genomes relate in general, clustering how they differ
// here.
const MafClusterDialog = observer(function MafClusterDialog({
  model,
  handleClose,
}: {
  model: MafClusterSelf
  handleClose: () => void
}) {
  const sources = model.clusterableSources.map(s => s.name)
  return (
    <ClusterDialog
      model={model}
      handleClose={handleClose}
      title="Cluster rows by identity"
      description="This procedure will cluster the alignment rows by how much of the window each one aligns and matches at, using hierarchical clustering"
      matrixLabel="identity matrix"
      tsvFilename="identity.tsv"
      canRun={model.autoClusterReady}
      matrixKey={sources.length ? ['identityMatrix', model] : null}
      run={args => runMafClustering({ model, ...args })}
      // The same rows the auto path clusters, or a pasted order indexes against
      // a different row set.
      fetchMatrix={({ rpcManager, sessionId, ...args }) =>
        rpcManager.call(sessionId, 'LinearMafGetIdentityMatrix', {
          sources,
          adapterConfig: model.adapterConfig,
          byteLimit: model.resolvedByteLimit(),
          ...args,
        })
      }
      applyOrder={(order, matrixRowNames) => {
        model.setRowOrder(
          clusteredCladeLayout({
            rows: model.clusterableSources,
            editableSources: model.editableSources,
            order,
            matrixRowNames,
          }),
        )
      }}
    />
  )
})

export default MafClusterDialog
