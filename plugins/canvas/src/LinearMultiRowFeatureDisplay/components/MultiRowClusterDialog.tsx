import {
  ClusterDialog,
  buildClusteredLayout,
  validateClusterOrder,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import {
  featureMatrixKey,
  runMultiRowClustering,
} from '../runMultiRowClustering.ts'

import type { MultiRowClusterDialogModel } from '../runMultiRowClustering.ts'

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
  model: MultiRowClusterDialogModel
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
      matrixKey={featureMatrixKey(model)}
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
      applyOrder={(order, matrixRowNames) => {
        // the same rows `fetchMatrix` keyed the matrix by, so a partition value
        // discovered while the user was in R is caught rather than shifting
        // every rank below it onto the wrong row
        validateClusterOrder(order, sourcesWithoutLayout, matrixRowNames)
        model.setLayout(
          buildClusteredLayout(sourcesWithoutLayout, model.layout, order),
        )
      }}
    />
  )
})

export default MultiRowClusterDialog
