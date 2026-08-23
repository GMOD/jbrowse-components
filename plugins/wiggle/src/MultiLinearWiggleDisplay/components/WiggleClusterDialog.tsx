import { getContainingView, getRpcHost } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
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
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// What "cluster rows by score" means for a multi-wiggle display: the score matrix
// over the visible region, binned at the chosen sampling density. The dialog
// itself is shared.
const WiggleClusterDialog = observer(function WiggleClusterDialog({
  model,
  handleClose,
}: {
  model: ReducedModel
  handleClose: () => void
}) {
  const { samplesPerPixel, setSamplesPerPixel } = useClusterSamplingOptions()
  const view = getContainingView(model) as LinearGenomeViewModel
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
      run={async ({ stopToken, statusCallback }) => {
        if (!view.initialized) {
          throw new Error(
            'The view is not initialized yet, please wait and try again',
          )
        }
        if (model.sourcesWithoutLayout.length < 2) {
          throw new Error('Need at least two subtracks to cluster')
        }
        await runWiggleClustering({
          model,
          rpcManager: getRpcHost(model).rpcManager,
          sessionId: getRpcSessionId(model),
          samplesPerPixel,
          stopToken,
          statusCallback,
        })
      }}
      fetchMatrix={({ stopToken, statusCallback }) =>
        getRpcHost(model).rpcManager.call(
          getRpcSessionId(model),
          'MultiWiggleGetScoreMatrix',
          {
            ...clusterScoreMatrixArgs(model, samplesPerPixel),
            stopToken,
            statusCallback,
          },
        )
      }
      applyOrder={order => {
        validateClusterOrder(order, model.sourcesWithoutLayout.length)
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
