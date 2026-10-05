import { quantileExtent } from '@jbrowse/core/util/quantileExtent'
import { withMarkColor } from '@jbrowse/plugin-marks'

import type { HeldLane, LaneFetchSpec } from './laneFetch.ts'
import type { FetchRegion } from './layoutMultiWay.ts'
import type { MultiWayCell } from './multiwayRenderTypes.ts'
import type {
  EncodedChannels,
  LayerRequest,
} from '@jbrowse/core/util/markEncoding'
import type { ColorSource } from '@jbrowse/plugin-marks'
import type { BarChannels } from '@jbrowse/render-core/marks'

export const LANE_LAYER_GAP_PX = 2

// 1.25 MB of 2bit, about what a nine-lane star's gc5Base bigWigs read at TP53
export const LANE_TEMPLATE_MAX_BP = 5_000_000

export interface LaneLayerSource {
  source: string
  adapterConfig: Record<string, unknown>
  template: boolean
}

export interface LaneLayerFetchSpec extends LaneFetchSpec {
  layer: number
  adapterConfig: Record<string, unknown>
  region: FetchRegion
  bpPerPx: number
  requests: LayerRequest[]
}

export interface HeldLaneLayer extends HeldLane {
  assemblyName: string
  layer: number
  region: FetchRegion
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

const coloredLayers = new WeakMap<
  EncodedChannels,
  { color: ColorSource; colored: EncodedChannels }
>()

/**
 * A lane layer's payload coloured as its mark declares, as the mark display
 * colours its regions, so a colour edit recolours what is held and fetches
 * nothing. Kept per payload and colour, so the bar cell built on it is reused
 * and uploads nothing new.
 */
export function coloredLaneLayer(
  channels: EncodedChannels,
  color: ColorSource,
) {
  const held = coloredLayers.get(channels)
  if (held?.color === color) {
    return held.colored
  }
  const colored = withMarkColor(channels, color)
  coloredLayers.set(channels, { color, colored })
  return colored
}

const barCells = new WeakMap<
  Uint32Array,
  {
    lo: number
    hi: number
    lut: Uint8Array | undefined
    color: EncodedChannels['color']
    colorValue: Float32Array | undefined
    cell: MultiWayCell | undefined
  }
>()

/**
 * One cell per payload, keyed on what it uploads. `x` stands for the payload,
 * since every recolouring of one payload shares it; its colour lanes, the y
 * domain it is squished into and the ramp's lookup table then say whether
 * anything uploaded moved. The ramp's domain and a threshold's cuts ride the
 * bar layer the pass reads per block, so a settle, a landing that widens the
 * ramp and an edit to a scale's ends or cuts rebuild no cell.
 *
 * Every layer's bars share one pass, so two layers on different ramps swap its
 * ramp texture within a frame, a new texture each time; the mark display's
 * pass per mark (`withPassId`) avoids that. Accepted unmeasured while two
 * ramp-coloured layers are rare.
 */
export function barCellOf(
  channels: EncodedChannels,
  domain: [number, number],
  lut?: Uint8Array,
) {
  const [lo, hi] = domain
  const { x, color, colorValue } = channels
  const held = barCells.get(x)
  if (
    held?.lo === lo &&
    held.hi === hi &&
    held.lut === lut &&
    held.color === color &&
    held.colorValue === colorValue
  ) {
    return held.cell
  }
  const data = barChannelsOf(channels, domain)
  const cell: MultiWayCell | undefined = data && { kind: 'bars', data, lut }
  barCells.set(x, { lo, hi, lut, color, colorValue, cell })
  return cell
}

export const LANE_LAYER_DOMAIN_QUANTILE = 0.99

/** one per layer, shared by every lane; undefined for a layer with no values */
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

export function laneLayerOrigin([min, max]: [number, number]) {
  return Math.min(Math.max(0, min), max)
}

/**
 * Stack px through the lane's map and the drag, sorted since a mirrored lane
 * hands the ends crossed.
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
