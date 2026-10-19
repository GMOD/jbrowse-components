import { quantileExtent } from '@jbrowse/core/util/quantileExtent'
import { toTrackConfigEntry } from '@jbrowse/core/util/tracks'
import {
  layerColorScale,
  markLayerRequest,
  stepChannels,
  withMarkColor,
} from '@jbrowse/plugin-marks'
import { isThreshold } from '@jbrowse/render-core/marks'

import { regionKey } from './laneFetch.ts'
import { frameSegments } from './layoutMultiWay.ts'

import type { HeldLane, LaneFetchSpec, LaneWindow } from './laneFetch.ts'
import type { Lane } from './laneStack.ts'
import type { FetchRegion, Span } from './layoutMultiWay.ts'
import type { BarLayer, MultiWayCell } from './multiwayRenderTypes.ts'
import type { AnyTrackConfig } from '@jbrowse/core/configuration'
import type {
  EncodedChannels,
  LayerRequest,
} from '@jbrowse/core/util/markEncoding'
import type { ColorSource } from '@jbrowse/plugin-marks'
import type { BarChannels, MarkColorScale } from '@jbrowse/render-core/marks'

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

export interface LaneLayerSourcesInputs {
  lanes: readonly string[]
  trackFor: (layer: number, lane: string) => AnyTrackConfig | undefined
  templates: readonly (Record<string, unknown> | undefined)[]
}

/**
 * Per layer, the adapter each lane reads: its named track, else the layer's
 * template where the adapter reads a reference.
 */
export function laneLayerSourcesOf({
  lanes,
  trackFor,
  templates,
}: LaneLayerSourcesInputs) {
  return templates.map((template, layer) => {
    const out = new Map<string, LaneLayerSource>()
    for (const lane of lanes) {
      const track = trackFor(layer, lane)
      if (track) {
        out.set(lane, {
          source: track.trackId,
          adapterConfig: toTrackConfigEntry(track).adapter as Record<
            string,
            unknown
          >,
          template: false,
        })
      }
    }
    if (template) {
      const source = `adapter:${JSON.stringify(template)}`
      for (const lane of lanes) {
        if (!out.has(lane)) {
          out.set(lane, { source, adapterConfig: template, template: true })
        }
      }
    }
    return out
  })
}

type LayerMark = Parameters<typeof markLayerRequest>[0]

export interface LaneLayerReadsInputs {
  layers: readonly { marks: readonly LayerMark[] }[]
  sources: readonly Map<string, LaneLayerSource>[]
  windows: ReadonlyMap<string, LaneWindow>
}

/** `pastCap` flags a layer that skipped a lane past `LANE_TEMPLATE_MAX_BP`. */
export function laneLayerReadsOf({
  layers,
  sources,
  windows,
}: LaneLayerReadsInputs) {
  const specs: LaneLayerFetchSpec[] = []
  const pastCap = layers.map(() => false)
  layers.forEach(({ marks }, layer) => {
    for (const [assemblyName, window] of windows) {
      const from = sources[layer]?.get(assemblyName)
      if (!from) {
        continue
      }
      const regions = from.template ? window.templateRegions : window.regions
      if (
        !regions ||
        (from.template &&
          regions.some(r => r.end - r.start > LANE_TEMPLATE_MAX_BP))
      ) {
        pastCap[layer] = true
        continue
      }
      const bpPerPx = laneLayerBpPerPx(window.bpPerPx)
      const requests = marks.map(m =>
        markLayerRequest(m, stepChannels(m.transform), bpPerPx),
      )
      const signature = JSON.stringify(requests)
      regions.forEach((region, i) => {
        specs.push({
          lane: laneLayerSpecLane(assemblyName, layer, i),
          key: `${from.source}@${regionKey(region)}@${bpPerPx}@${signature}`,
          assemblyName,
          layer,
          adapterConfig: from.adapterConfig,
          region,
          bpPerPx,
          requests,
        })
      })
    }
  })
  return { specs, pastCap }
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
 * A lane layer's payload colored as its mark declares, as the mark display
 * colors its regions, so a color edit recolors what is held and fetches
 * nothing. Kept per payload and color, so the bar cell built on it is reused
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
 * since every recoloring of one payload shares it; its color lanes, the y
 * domain it is squished into and the ramp's lookup table then say whether
 * anything uploaded moved. The ramp's domain and a threshold's cuts ride the
 * bar layer the pass reads per block, so a settle, a landing that widens the
 * ramp and an edit to a scale's ends or cuts rebuild no cell.
 *
 * Every layer's bars share one pass, so two layers on different ramps swap its
 * ramp texture within a frame, a new texture each time; the mark display's
 * pass per mark (`withPassId`) avoids that. Accepted unmeasured while two
 * ramp-colored layers are rare.
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

export interface LaneLayerPlacement {
  specLane: string
  held: HeldLaneLayer
  row: number
  top: number
  height: number
  segments: { start: number; end: number; px: Span }[]
}

export interface LaneLayerPlacementInputs {
  lanes: readonly Lane[]
  heights: readonly number[]
  held: ReadonlyMap<string, HeldLaneLayer> | undefined
  axisSpanOf: (refName: string, start: number, end: number) => Span | undefined
  canvasWidth: number
}

/**
 * Each payload's region placed in its lane's own frame; a payload whose lane
 * or contig no longer draws is left out.
 */
export function laneLayerPlacementsOf({
  lanes,
  heights,
  held: heldByLane,
  axisSpanOf,
  canvasWidth,
}: LaneLayerPlacementInputs) {
  const rowOf = new Map(lanes.map((lane, row) => [lane.assemblyName, row]))
  const out: LaneLayerPlacement[] = []
  for (const [specLane, held] of heldByLane ?? []) {
    const row = rowOf.get(held.assemblyName)
    const lane = row === undefined ? undefined : lanes[row]
    const height = heights[held.layer]
    if (!lane || row === undefined || height === undefined) {
      continue
    }
    const { refName, start, end } = held.region
    const anchorPx =
      lane.isAnchor && axisSpanOf(lane.canon(refName), start, end)
    const segments = anchorPx
      ? [{ start, end, px: anchorPx }]
      : !lane.isAnchor &&
          lane.frame &&
          lane.canon(lane.frame.refName) === lane.canon(refName)
        ? frameSegments(lane.frame, start, end, canvasWidth)
        : []
    if (segments.length) {
      out.push({
        specLane,
        held,
        row,
        top: layerBandTops(lane.layerTop, heights)[held.layer]!,
        height,
        segments,
      })
    }
  }
  return out
}

export interface LaneLayerCellInputs {
  placements: readonly LaneLayerPlacement[]
  domains: readonly ([number, number] | undefined)[]
  colorScales: readonly (readonly (MarkColorScale | undefined)[])[]
  coloredLayersOf: (held: HeldLaneLayer) => EncodedChannels[]
}

export function laneLayerCellsOf({
  placements,
  domains,
  colorScales,
  coloredLayersOf,
}: LaneLayerCellInputs) {
  const cells = new Map<string, MultiWayCell>()
  const layers: BarLayer[] = []
  for (const { specLane, held, row, top, height, segments } of placements) {
    const domain = domains[held.layer]
    if (!domain) {
      continue
    }
    coloredLayersOf(held).forEach((channels, mark) => {
      const colorScale = layerColorScale(
        channels,
        colorScales[held.layer]?.[mark],
      )
      const cell = barCellOf(
        channels,
        domain,
        colorScale && !isThreshold(colorScale) ? colorScale.lut : undefined,
      )
      if (cell) {
        // one block per piece between the lane's holes, each its own cell
        segments.forEach(({ start, end, px }, piece) => {
          const key = `bars:${specLane}:${mark}${piece ? `:${piece}` : ''}`
          cells.set(key, cell)
          layers.push({
            kind: 'bars',
            key,
            row,
            top,
            height,
            domain,
            origin: laneLayerOrigin(domain),
            colorScale,
            start,
            end,
            px,
          })
        })
      }
    })
  }
  return { cells, layers }
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
