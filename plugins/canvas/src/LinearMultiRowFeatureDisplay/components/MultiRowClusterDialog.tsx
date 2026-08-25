import {
  ClusterDialog,
  buildClusteredLayout,
  validateClusterOrder,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { runMultiRowClustering } from '../runMultiRowClustering.ts'

import type { MultiRowClusterModel } from '../runMultiRowClustering.ts'
import type { MultiRowSource } from '../sourcesLogic.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// What "cluster rows by similarity" means for the multi-row painting: each row's
// painted colors, binned over the visible region. The dialog itself is shared
// with the other row displays, and `run` is the same function the declarative
// `runClustering` autorun calls — this display used to fire that flag straight
// from the menu, which left it the one row display with no cancel, no progress
// and no R-script path.
const MultiRowClusterDialog = observer(function MultiRowClusterDialog({
  model,
  handleClose,
}: {
  model: IStateTreeNode &
    MultiRowClusterModel & { setLayout: (layout: MultiRowSource[]) => void }
  handleClose: () => void
}) {
  const { sourcesWithoutLayout } = model
  return (
    <ClusterDialog
      model={model}
      handleClose={handleClose}
      title="Cluster rows by similarity"
      description="This procedure will cluster the rows by the colors each one is painted in across the window in view, using hierarchical clustering"
      matrixLabel="feature matrix"
      tsvFilename="features.tsv"
      canRun={sourcesWithoutLayout.length > 1}
      matrixKey={sourcesWithoutLayout.length ? ['featureMatrix', model] : null}
      run={args => runMultiRowClustering({ model, ...args })}
      fetchMatrix={({ rpcManager, sessionId, ...args }) =>
        rpcManager.call(sessionId, 'MultiRowGetFeatureMatrix', {
          sources: sourcesWithoutLayout.map(s => s.name),
          adapterConfig: model.adapterConfig,
          partitionField: model.effectivePartitionField,
          colorConfig: model.colorConfig,
          ...args,
        })
      }
      applyOrder={order => {
        validateClusterOrder(order, sourcesWithoutLayout.length)
        model.setLayout(
          buildClusteredLayout(sourcesWithoutLayout, model.layout, order),
        )
      }}
    />
  )
})

export default MultiRowClusterDialog
