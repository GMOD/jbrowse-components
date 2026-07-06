import { getContainingView, useLocalStorage } from '@jbrowse/core/util'

import { parseSamplesPerPixel } from './parseSamplesPerPixel.ts'

import type { ReducedModel } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
    '1',
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
