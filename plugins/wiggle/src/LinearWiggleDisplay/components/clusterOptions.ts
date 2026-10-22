import { useLocalStorage } from '@jbrowse/core/util/hooks'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import { resolveSymlogConstant } from '@jbrowse/wiggle-core'

import { parseSamplesPerPixel } from './parseSamplesPerPixel.ts'

import type { ReducedModel } from '../clusterModelTypes.ts'
import type { Region } from '@jbrowse/core/util'

// One sample per pixel. The declarative `runClustering` autorun deliberately
// clusters at this density rather than reading the persisted preference below:
// it fires from a session snapshot or a website figure spec, so its result has
// to be reproducible on a machine that has never opened the dialog.
export const DEFAULT_SAMPLES_PER_PIXEL = '1'

// `ClusterAdvancedOptions` reads the same localStorage key for every
// clusterable display.
export function useClusterSamplingOptions() {
  const [samplesPerPixel, setSamplesPerPixel] = useLocalStorage(
    'cluster-samplesPerPixel',
    DEFAULT_SAMPLES_PER_PIXEL,
  )
  return { samplesPerPixel, setSamplesPerPixel }
}

// Score-matrix RPC args for both the session-triggered run and the dialog.
// The density comes from the run's own span, not the view's zoom: the columns
// are pixel bins, so clustering a 140 kb locus while the view shows 10 Mb would
// otherwise bin it into a handful of columns. The field is the plot's `y` and
// the scores sit where a log or symlog axis draws them, so rows cluster on the
// heights on screen.
export function clusterScoreMatrixArgs(
  model: ReducedModel,
  samplesPerPixel: string,
  regions: Region[],
) {
  const view = containingLgv(model)
  const density = parseSamplesPerPixel(samplesPerPixel)
  const width = view.width || 1
  const span = regions.reduce((a, r) => a + (r.end - r.start), 0)
  return {
    regions,
    sources: model.clusterableSources,
    adapterConfig: model.adapterConfig,
    yField: model.yField,
    bpPerPx: span / width / density,
    scale: matrixScale(model),
  }
}

function matrixScale({ scaleType, domain, symlogConstant }: ReducedModel) {
  return domain && scaleType !== 'linear'
    ? {
        scaleType: scaleTypeCode(scaleType),
        domain,
        symlogConstant: resolveSymlogConstant(
          domain[0],
          domain[1],
          symlogConstant,
        ),
      }
    : undefined
}
