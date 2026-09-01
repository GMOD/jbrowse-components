import { foundationDisplayPhase } from '@jbrowse/display-kit/foundationDisplayPhase'
import { foundationSvgReady } from '@jbrowse/display-kit/foundationSvgReady'

import { densityBandLayer, formatDensity } from './densityBand.ts'

import type { DensityBandLayer } from './densityBand.ts'
import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { DisplayPhaseFoundation } from '@jbrowse/display-kit/foundationDisplayPhase'
import type { SvgReadyFoundation } from '@jbrowse/display-kit/foundationSvgReady'
import type { RegionHost } from '@jbrowse/display-kit/regionHost'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

/**
 * What the density band reads off the display composing it: `DensityTierMixin`'s
 * read and its swap decision, plus the phase foundation's own terms so the
 * override below post-processes the base rather than restating it.
 */
export interface DensityBandHost
  extends DisplayPhaseFoundation, SvgReadyFoundation {
  host: RegionHost
  densityBins: ReadonlyMap<number, FeatureDensity>
  densityBinsKey: string | undefined
  densityLoading: boolean
  densityError: unknown
  densityTierActive: boolean
  viewportWithinLoadedData: boolean
  dataSuperseded: boolean
}

export function displayDensityBandLayer(
  self: DensityBandHost,
): DensityBandLayer {
  return densityBandLayer(self.densityBins, self.host.coarseBpPerPx)
}

/**
 * Whether the band is still waiting on its first read for what is on screen.
 * The key, not a per-region check against `visibleRegions`: that array rebuilds
 * on every frame of every gesture, and this feeds `displayPhase`. It is cleared
 * on navigation with the bins, so it cannot answer for a region the user has
 * left, and a read that committed nothing for a region still ends the wait —
 * an empty band is the honest answer there, where 'loading' would never lift.
 */
export function densityBandPending(self: DensityBandHost) {
  return (
    self.densityLoading ||
    (self.densityBinsKey === undefined && self.densityError === undefined)
  )
}

/**
 * The phase with the band standing in. Where the tier is active the display is
 * drawing the band and nothing else, so the base's fetch terms are not its
 * loading question: not the banner, whose verdict is untouched underneath, and
 * not the feature fetch, which `fetchSuspended` has stopped where the gate was
 * not already stopping it. The band's own read is, so the phase is `loading`
 * until it lands and `ready` after. The two failure terminals pass through,
 * and so does a standing cancel: its Retry chrome is the way back, and the
 * export gate fails on it after the wait.
 */
export function densityBandDisplayPhase(self: DensityBandHost): DisplayPhase {
  const base = foundationDisplayPhase(
    self,
    () => self.viewportWithinLoadedData && !self.dataSuperseded,
    () => self.host.effectiveBodyMounted,
  )
  return self.densityTierActive &&
    !self.fetchCanceled &&
    base !== 'error' &&
    base !== 'renderError'
    ? densityBandPending(self)
      ? 'loading'
      : 'ready'
    : base
}

/**
 * The export gate under the same swap: `regionTooLarge` is a terminal in
 * `computeSvgReady` because nothing is coming, and `dataCurrent` waits on a
 * feature fetch that is not running, so with the band up the bins are what the
 * export waits for.
 */
export function densityBandSvgReady(self: DensityBandHost) {
  return self.densityTierActive
    ? !!self.error || self.fetchCanceled || !densityBandPending(self)
    : foundationSvgReady(self)
}

/** Where the cursor is over the band, in the density read's own coordinates. */
export interface DensityHover {
  displayedRegionIndex: number
  bp: number
}

/**
 * The cursor's place in the density read, or nothing off the ends of the view.
 * `coord0` rather than `coord`: the read's intervals are absolute 0-based, the
 * worker's uint32 contract.
 */
export function densityHoverAt(
  view: {
    initialized: boolean
    pxToBp: (px: number) => { index: number; coord0: number; oob: boolean }
  },
  px: number | undefined,
): DensityHover | undefined {
  if (px === undefined || !view.initialized) {
    return undefined
  }
  const at = view.pxToBp(px)
  return at.oob ? undefined : { displayedRegionIndex: at.index, bp: at.coord0 }
}

/** The source's value over `bp`, or undefined where no interval covers it. */
export function densityValueAt(
  bins: ReadonlyMap<number, FeatureDensity>,
  { displayedRegionIndex, bp }: DensityHover,
) {
  const density = bins.get(displayedRegionIndex)
  if (density) {
    const { starts, ends, scores } = density
    for (let i = 0; i < starts.length; i++) {
      if (starts[i]! <= bp && bp < ends[i]!) {
        return scores[i]!
      }
    }
  }
  return undefined
}

/**
 * The band's one line of text: the peak it is scaled to, and the source's
 * value under the cursor while there is one. The value is the sidecar's own
 * (features per bin for a `make-density` file), so no unit is claimed.
 */
export function densityBandReadout(
  layer: DensityBandLayer,
  bins: ReadonlyMap<number, FeatureDensity>,
  hover: DensityHover | undefined,
) {
  const value = hover ? densityValueAt(bins, hover) : undefined
  const peak = `peak ${formatDensity(layer.maxDepth)}`
  return value === undefined
    ? peak
    : `${formatDensity(value)} at cursor, ${peak}`
}
