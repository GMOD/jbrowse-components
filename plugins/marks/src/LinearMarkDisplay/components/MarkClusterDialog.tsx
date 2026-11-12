import { ClusterDialog, MIN_CLUSTER_ROWS } from '@jbrowse/tree-sidebar'
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
  const { shownRows } = model
  return (
    <ClusterDialog
      model={model}
      handleClose={handleClose}
      title="Cluster rows by similarity"
      description={`This procedure will cluster the rows by ${model.rowCompare?.by === 'y' ? 'the values their bars or points stand at' : `their ${model.rowCompareLabel}`} across the window in view, using hierarchical clustering`}
      matrixLabel="value matrix"
      tsvFilename="rows.tsv"
      canRun={
        shownRows.length >= MIN_CLUSTER_ROWS && model.rowCompare !== undefined
      }
      matrixKey={rowMatrixKey(model)}
      run={args => runMarkClustering({ model, ...args })}
      fetchMatrix={async ({ rpcManager, sessionId, regions, ...handles }) =>
        rpcManager.call(sessionId, 'MarkGetRowMatrix', {
          ...(await markRowMatrixArgs(model, regions, handles.signal)),
          ...handles,
        })
      }
    />
  )
})

export default MarkClusterDialog
