import {
  ClusterDialog,
  buildClusteredLayout,
  validateClusterOrder,
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
  return (
    <ClusterDialog
      model={model}
      handleClose={handleClose}
      title="Cluster rows by score"
      maxWidth="xl"
      matrixLabel="score matrix"
      tsvFilename="scores.tsv"
      canRun={!!model.sourcesWithoutLayout.length}
      matrixKey={
        model.sourcesWithoutLayout.length
          ? ['scoreMatrix', model, samplesPerPixel]
          : null
      }
      run={async args => {
        if (model.sourcesWithoutLayout.length < 2) {
          throw new Error('Need at least two subtracks to cluster')
        }
        await runWiggleClustering({ model, samplesPerPixel, ...args })
      }}
      fetchMatrix={({ rpcManager, sessionId, regions, ...handles }) =>
        rpcManager.call(sessionId, 'MultiWiggleGetScoreMatrix', {
          ...clusterScoreMatrixArgs(model, samplesPerPixel, regions),
          ...handles,
        })
      }
      applyOrder={(order, matrixRowNames) => {
        validateClusterOrder(order, model.sourcesWithoutLayout, matrixRowNames)
        model.setLayout(
          buildClusteredLayout(model.sourcesWithoutLayout, model.layout, order),
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
