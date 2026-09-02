import { getContainingView } from '@jbrowse/core/util'
import { useLocalStorage } from '@jbrowse/core/util/hooks'

import { parseSamplesPerPixel } from './parseSamplesPerPixel.ts'

import type { ReducedModel } from '../clusterModelTypes.ts'
import type { Region } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// One sample per pixel. The declarative `runClustering` autorun deliberately
// clusters at this density rather than reading the persisted preference below:
// it fires from a session snapshot or a website figure spec, so its result has
// to be reproducible on a machine that has never opened the dialog.
export const DEFAULT_SAMPLES_PER_PIXEL = '1'

// The auto and manual dialogs persist the sampling density to the same
// localStorage key so a value set in one dialog carries to the other — sharing
// one hook keeps the key from drifting apart. The advanced-options disclosure
// is `ClusterAdvancedOptions`', which owns that key for every clusterable
// display.
export function useClusterSamplingOptions() {
  const [samplesPerPixel, setSamplesPerPixel] = useLocalStorage(
    'cluster-samplesPerPixel',
    DEFAULT_SAMPLES_PER_PIXEL,
  )
  return { samplesPerPixel, setSamplesPerPixel }
}

// Score-matrix RPC args shared by MultiWiggleClusterScoreMatrix (auto) and
// MultiWiggleGetScoreMatrix (manual). bpPerPx is divided by the sampling
// density so both RPCs bin at the same resolution and produce comparable
// matrices.
//
// `regions` is the run's own — the `clusterRegion` locus for a session-triggered
// run, the visible blocks for a dialog one — and both entry points resolve it
// before they get here (`ClusterRunArgs.regions`). The density is derived from
// that span rather than from the view's own zoom. It has to be: the columns are
// pixel bins, so clustering a 140 kb locus while the view shows 10 Mb would bin
// it into a handful of columns and the matrix would be degenerate without
// anything saying so. Deriving it from the span is the density the same locus
// would have if you had zoomed to it, which is what the setting means.
export function clusterScoreMatrixArgs(
  model: ReducedModel,
  samplesPerPixel: string,
  regions: Region[],
) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const density = parseSamplesPerPixel(samplesPerPixel)
  const width = view.width || 1
  const span = regions.reduce((a, r) => a + (r.end - r.start), 0)
  return {
    regions,
    sources: model.sourcesWithoutLayout,
    adapterConfig: model.adapterConfig,
    bpPerPx: span / width / density,
  }
}
