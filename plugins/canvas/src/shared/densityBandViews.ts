import { densityBandLayer, formatDensity } from './densityBand.ts'

import type { DensityBandLayer } from './densityBand.ts'
import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { DensityBandPhaseHost } from '@jbrowse/display-kit/densityBandPhase'
import type { RegionHost } from '@jbrowse/display-kit/regionHost'

/**
 * What the density band reads off the display composing it: the phase host's
 * terms, the bins the layer is packed from, and the view geometry it is packed
 * at.
 */
export interface DensityBandHost extends DensityBandPhaseHost {
  host: RegionHost
  densityTierActive: boolean
  densityBins: ReadonlyMap<number, FeatureDensity>
}

export function displayDensityBandLayer(
  self: DensityBandHost,
): DensityBandLayer {
  return densityBandLayer(self.densityBins, self.host.coarseBpPerPx)
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
 * (features per bin for a `make-density` file), so no unit is claimed. A layer
 * with no depth says so, since the band otherwise draws nothing at all and an
 * empty track cannot be told from a broken sidecar.
 */
export function densityBandReadout(
  layer: DensityBandLayer,
  bins: ReadonlyMap<number, FeatureDensity>,
  hover: DensityHover | undefined,
) {
  const value = hover ? densityValueAt(bins, hover) : undefined
  const peak = `density peak ${formatDensity(layer.maxDepth)}`
  return layer.maxDepth === 0
    ? 'no density data in view'
    : value === undefined
      ? peak
      : `${formatDensity(value)} at cursor, ${peak}`
}
