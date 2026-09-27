import { quantileExtent } from '@jbrowse/core/util/quantileExtent'

import type { LaneFetchSpec, LaneRegion } from './laneFetch.ts'
import type { MultiWayCell } from './multiwayRenderTypes.ts'
import type {
  EncodedChannels,
  LayerRequest,
} from '@jbrowse/core/util/markEncoding'
import type { BarChannels } from '@jbrowse/render-core/marks'

export const LANE_LAYER_GAP_PX = 2

/**
 * The widest region a lane reads a template through its own genome's
 * sequence for: 1.25 MB of 2bit, so a nine-lane star at the cap reads about
 * what its nine gc5Base bigWigs do at TP53
 */
export const LANE_TEMPLATE_MAX_BP = 5_000_000

/**
 * what one lane reads a layer from: a track's adapter, or the layer's
 * template read through the lane's own genome. `source` names it in a
 * fetch key
 */
export interface LaneLayerSource {
  source: string
  adapterConfig: Record<string, unknown>
  template: boolean
}

export interface LaneLayerFetchSpec extends LaneFetchSpec {
  assemblyName: string
  layer: number
  adapterConfig: Record<string, unknown>
  region: LaneRegion
  bpPerPx: number
  requests: LayerRequest[]
}

export interface HeldLaneLayer {
  key: string
  assemblyName: string
  layer: number
  region: LaneRegion
  channels: EncodedChannels[]
}

export function laneLayersPx(heights: readonly number[]) {
  return heights.reduce((sum, height) => sum + height + LANE_LAYER_GAP_PX, 0)
}

export function layerBandTops(layerTop: number, heights: readonly number[]) {
  const tops: number[] = []
  let y = layerTop
  for (const height of heights) {
    tops.push(y)
    y += height + LANE_LAYER_GAP_PX
  }
  return tops
}

/**
 * The zoom a lane's layer is read at, snapped to a power of two so a window
 * resize inside one refetches nothing
 */
export function laneLayerBpPerPx(bpPerPx: number) {
  return 2 ** Math.round(Math.log2(Math.max(bpPerPx, 1e-3)))
}

export function laneLayerSpecLane(
  assemblyName: string,
  layer: number,
  region: number,
) {
  return `${assemblyName}\u0000${layer}\u0000${region}`
}

/**
 * A payload's bars with every value outside `domain` squished to the end it
 * passed, so a bar the shared scale cannot hold stands full height rather than
 * wearing the clip strip: the domain is clipped by design here, not by a reader
 */
export function barChannelsOf(
  channels: EncodedChannels,
  [lo, hi]: [number, number],
): BarChannels | undefined {
  const { x, x2, y, color, colorValue, count } = channels
  if (!y) {
    return undefined
  }
  let squished: Float32Array | undefined
  for (let i = 0; i < count; i++) {
    const v = y[i]!
    if (v < lo || v > hi) {
      squished ??= y.slice(0, count)
      squished[i] = v < lo ? lo : hi
    }
  }
  return { x, x2, y: squished ?? y, color, colorValue, count }
}

const barCells = new WeakMap<
  EncodedChannels,
  { lo: number; hi: number; cell: MultiWayCell | undefined }
>()

/** `barChannelsOf` as a cell, one per payload and domain, so a settle re-uploads nothing */
export function barCellOf(channels: EncodedChannels, domain: [number, number]) {
  const [lo, hi] = domain
  const held = barCells.get(channels)
  if (held?.lo === lo && held.hi === hi) {
    return held.cell
  }
  const data = barChannelsOf(channels, domain)
  const cell: MultiWayCell | undefined = data && { kind: 'bars', data }
  barCells.set(channels, { lo, hi, cell })
  return cell
}

export const LANE_LAYER_DOMAIN_QUANTILE = 0.99

/**
 * Each layer's value domain, one per layer and shared by every lane: what
 * every lane holds, each end clipped at the 99th percentile of its side, so a
 * genome reads against the others and no one lane's outliers set the scale.
 * Undefined for a layer holding no values yet
 */
export function laneLayerDomains(
  held: Iterable<HeldLaneLayer>,
  layerCount: number,
): ([number, number] | undefined)[] {
  const values = Array.from({ length: layerCount }, () => [] as Float32Array[])
  for (const { layer, channels } of held) {
    for (const { y, count } of channels) {
      if (y && layer < layerCount) {
        values[layer]!.push(y.subarray(0, count))
      }
    }
  }
  return values.map(parts => {
    const all = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
    let offset = 0
    for (const part of parts) {
      all.set(part, offset)
      offset += part.length
    }
    const [min, max] = quantileExtent(
      all,
      all.length,
      LANE_LAYER_DOMAIN_QUANTILE,
    )
    return min > max ? undefined : min === max ? [min - 1, max + 1] : [min, max]
  })
}

/** where a bar grows from inside a domain: zero where the domain spans it, else its nearer end */
export function laneLayerOrigin([min, max]: [number, number]) {
  return Math.min(Math.max(0, min), max)
}

/**
 * A layer payload's block, from its region's two ends in stack px through the
 * lane's map and the drag. Sorted, since a mirrored lane hands the ends
 * crossed, and a block's screen span must run left to right
 */
export function laneLayerBlockSpan(
  px: readonly [number, number],
  map: { scale: number; offset: number },
  dragOffsetPx: number,
) {
  const a = map.scale * px[0] + map.offset + dragOffsetPx
  const b = map.scale * px[1] + map.offset + dragOffsetPx
  return {
    screenStartPx: Math.min(a, b),
    screenEndPx: Math.max(a, b),
    reversed: a > b,
  }
}
