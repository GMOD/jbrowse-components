import {
  ClusterDialog,
  MIN_CLUSTER_ROWS,
  clusteredCladeLayout,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import {
  markRowMatrixArgs,
  rowMatrixKey,
  runMarkClustering,
} from '../runMarkClustering.ts'

import type { MarkClusterDialogModel } from '../runMarkClustering.ts'

const MarkClusterDialog = observer(function MarkClusterDialog({
  model,
  handleClose,
}: {
  model: MarkClusterDialogModel
  handleClose: () => void
}) {
  const { clusterableSources } = model
  return (
    <ClusterDialog
      model={model}
      handleClose={handleClose}
      title="Cluster rows by similarity"
      description="This procedure will cluster the rows by the values their bars or points stand at across the window in view, using hierarchical clustering"
      matrixLabel="value matrix"
      tsvFilename="rows.tsv"
      canRun={
        clusterableSources.length >= MIN_CLUSTER_ROWS &&
        model.valueMarkIndex !== -1
      }
      matrixKey={rowMatrixKey(model)}
      run={args => runMarkClustering({ model, ...args })}
      fetchMatrix={({ rpcManager, sessionId, regions, ...handles }) =>
        rpcManager.call(sessionId, 'MarkGetRowMatrix', {
          ...markRowMatrixArgs(model, regions),
          ...handles,
        })
      }
      applyOrder={(order, matrixRowNames) => {
        model.setRowOrder(
          clusteredCladeLayout({
            rows: clusterableSources,
            editableSources: model.editableSources,
            order,
            matrixRowNames,
          }),
        )
      }}
    />
  )
})

export default MarkClusterDialog
