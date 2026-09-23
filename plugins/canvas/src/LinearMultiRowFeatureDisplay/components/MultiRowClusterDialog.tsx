import {
  ClusterDialog,
  MIN_CLUSTER_ROWS,
  clusteredCladeLayout,
} from '@jbrowse/tree-sidebar'
import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import {
  featureMatrixKey,
  runMultiRowClustering,
} from '../runMultiRowClustering.ts'

import type { MultiRowClusterDialogModel } from '../runMultiRowClustering.ts'

const MultiRowClusterDialog = observer(function MultiRowClusterDialog({
  model,
  handleClose,
}: {
  model: MultiRowClusterDialogModel
  handleClose: () => void
}) {
  const { clusterableSources, effectiveClusterField, effectivePartitionField } =
    model
  const clusterOn = effectiveClusterField
    ? `${effectiveClusterField} their features carry`
    : 'positions they cover'
  const candidates = model.partitionCandidates.filter(
    field => field !== effectivePartitionField,
  )
  // A configured field the loaded data has not offered still belongs in the
  // list: dropped, the control would read "Presence only" and say the wrong
  // thing about the tree on screen.
  const options =
    !effectiveClusterField || candidates.includes(effectiveClusterField)
      ? candidates
      : [effectiveClusterField, ...candidates]
  return (
    <ClusterDialog
      model={model}
      handleClose={handleClose}
      title="Cluster rows by similarity"
      description={`This procedure will cluster the rows by the ${clusterOn} across the window in view, using hierarchical clustering`}
      matrixLabel="feature matrix"
      tsvFilename="features.tsv"
      canRun={clusterableSources.length >= MIN_CLUSTER_ROWS}
      matrixKey={featureMatrixKey(model)}
      run={args => runMultiRowClustering({ model, ...args })}
      fetchMatrix={({ rpcManager, sessionId, ...args }) =>
        rpcManager.call(sessionId, 'MultiRowGetFeatureMatrix', {
          sources: clusterableSources.map(s => s.name),
          adapterConfig: model.adapterConfig,
          partitionField: model.effectivePartitionField,
          clusterField: model.effectiveClusterField,
          ...args,
        })
      }
      applyOrder={(order, matrixRowNames) => {
        // `matrixRowNames` is the rows `fetchMatrix` keyed the matrix by, so a
        // partition value discovered while the user was in R cannot shift every
        // rank below it onto the wrong row
        model.setRowOrder(
          clusteredCladeLayout({
            rows: clusterableSources,
            editableSources: model.editableSources,
            order,
            matrixRowNames,
          }),
        )
      }}
      advancedOptions={
        <TextField
          select
          size="small"
          label="Cluster on"
          style={{ marginTop: 20, minWidth: 200 }}
          value={effectiveClusterField}
          onChange={event => {
            model.setClusterField(event.target.value)
          }}
        >
          <MenuItem value="">Presence only</MenuItem>
          {options.map(field => (
            <MenuItem key={field} value={field}>
              {field}
            </MenuItem>
          ))}
        </TextField>
      }
    />
  )
})

export default MultiRowClusterDialog
