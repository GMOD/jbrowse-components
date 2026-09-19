import {
  ClusterDialog,
  MIN_CLUSTER_ROWS,
  clusteredCladeLayout,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { runWiggleClustering } from '../runWiggleClustering.ts'
import SamplesPerPixelField from './SamplesPerPixelField.tsx'
import {
  clusterScoreMatrixArgs,
  useClusterSamplingOptions,
} from './clusterOptions.ts'

import type { ReducedModel } from '../clusterModelTypes.ts'

// What "cluster rows by score" means for a multi-wiggle display: the score matrix
// over the visible region, binned at the chosen sampling density. The dialog
// itself is shared, and `run` is the same function the declarative
// `runClustering` autorun calls.
const WiggleClusterDialog = observer(function WiggleClusterDialog({
  model,
  handleClose,
}: {
  model: ReducedModel
  handleClose: () => void
}) {
  const { samplesPerPixel, setSamplesPerPixel } = useClusterSamplingOptions()
  // The two things about this display that change the matrix. The region and
  // the zoom are `ClusterManualTab`'s own key pieces, so they are not restated
  // here — and the display model is deliberately NOT one: `useFetch` serializes
  // the key, so passing the node stringified the whole display snapshot on
  // every render and re-fetched the matrix for a row relabel that cannot move a
  // score.
  const sourceNames = model.clusterableSources.map(s => s.name).join('\t')
  return (
    <ClusterDialog
      model={model}
      handleClose={handleClose}
      title="Cluster rows by score"
      maxWidth="xl"
      matrixLabel="score matrix"
      tsvFilename="scores.tsv"
      canRun={model.clusterableSources.length >= MIN_CLUSTER_ROWS}
      matrixKey={
        model.clusterableSources.length
          ? ['scoreMatrix', sourceNames, samplesPerPixel]
          : null
      }
      run={args => runWiggleClustering({ model, samplesPerPixel, ...args })}
      fetchMatrix={({ rpcManager, sessionId, regions, ...handles }) =>
        rpcManager.call(sessionId, 'MultiWiggleGetScoreMatrix', {
          ...clusterScoreMatrixArgs(model, samplesPerPixel, regions),
          ...handles,
        })
      }
      applyOrder={(order, matrixRowNames) => {
        model.setLayout(
          clusteredCladeLayout({
            rows: model.clusterableSources,
            editableSources: model.editableSources,
            layout: model.layout,
            order,
            matrixRowNames,
          }),
        )
      }}
      advancedOptions={
        <SamplesPerPixelField
          value={samplesPerPixel}
          onChange={val => {
            setSamplesPerPixel(val)
          }}
        />
      }
    />
  )
})

export default WiggleClusterDialog
