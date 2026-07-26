import { getContainingView } from '@jbrowse/core/util'
import { useLocalStorage } from '@jbrowse/core/util/hooks'

import { parseSamplesPerPixel } from './parseSamplesPerPixel.ts'

import type { ReducedModel } from '../clusterModelTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// One sample per pixel. The declarative `runClustering` autorun deliberately
// clusters at this density rather than reading the persisted preference below:
// it fires from a session snapshot or a website figure spec, so its result has
// to be reproducible on a machine that has never opened the dialog.
export const DEFAULT_SAMPLES_PER_PIXEL = '1'

// The auto and manual dialogs persist these sampling controls to the same
// localStorage keys so a value set in one dialog carries to the other — sharing
// one hook keeps the keys from drifting apart.
export function useClusterSamplingOptions() {
  const [showAdvanced, setShowAdvanced] = useLocalStorage(
    'cluster-showAdvanced',
    false,
  )
  const [samplesPerPixel, setSamplesPerPixel] = useLocalStorage(
    'cluster-samplesPerPixel',
    DEFAULT_SAMPLES_PER_PIXEL,
  )
  return { showAdvanced, setShowAdvanced, samplesPerPixel, setSamplesPerPixel }
}

// Score-matrix RPC args shared by MultiWiggleClusterScoreMatrix (auto) and
// MultiWiggleGetScoreMatrix (manual). bpPerPx is divided by the sampling
// density so both RPCs bin at the same resolution and produce comparable
// matrices.
export function clusterScoreMatrixArgs(
  model: ReducedModel,
  samplesPerPixel: string,
) {
  const view = getContainingView(model) as LinearGenomeViewModel
  return {
    regions: view.dynamicBlocks.contentBlocks,
    sources: model.sourcesWithoutLayout,
    adapterConfig: model.adapterConfig,
    bpPerPx: view.bpPerPx / parseSamplesPerPixel(samplesPerPixel),
  }
}
