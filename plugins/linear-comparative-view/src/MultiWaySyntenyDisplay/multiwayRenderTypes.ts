import { DEFAULT_OVERDRAW_PX } from '../LinearSyntenyView/consts.ts'

import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from '../LinearSyntenyDisplay/syntenyRenderingBackendTypes.ts'
import type { SyntenyOutlineChannels } from '../LinearSyntenyDisplay/syntenyRibbonMarks.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { PaintedFill } from './geneColor.ts'
import type { Feature } from '@jbrowse/core/util'
import type { RegionRenderData } from '@jbrowse/plugin-canvas'
import type { BarChannels, MarkColorScale } from '@jbrowse/render-core/marks'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { FrameDimensions } from '@jbrowse/render-core/renderingBackendBase'

/**
 * Glyph positions sit this far up in render-origin px, which fits the passes'
 * unsigned coordinate.
 */
export const PX_ORIGIN = 1 << 20

export interface GlyphHit {
  x1: number
  x2: number
  y1: number
  y2: number
  feature: Feature
  groupKey?: string
  label: string
  fill?: PaintedFill
}

export interface LaneGlyphData extends RegionRenderData {
  hits: GlyphHit[]
}

/** keys that outlive a rebuild of the targets */
export interface RibbonRef {
  groupKey?: string
  linkId?: string
}

export interface RibbonTarget extends RibbonRef {
  feature: Feature
  label: string
}

export type MultiWayCell =
  | { kind: 'ribbons'; data: SyntenyInstanceData }
  | ({ kind: 'outline' } & SyntenyOutlineChannels)
  | { kind: 'glyphs'; data: LaneGlyphData }
  | { kind: 'bars'; data: BarChannels; colorScale?: MarkColorScale }

export interface RibbonLayer {
  kind: 'ribbons'
  key: string
  yTop: number
  height: number
  curves: boolean
  rows: readonly [number, number]
}

export interface GlyphLayer {
  kind: 'glyphs'
  key: string
  scrolled: boolean
  /** undefined for the bands */
  row?: number
}

/** packed px `x` lands at `scale * x + offset`; a mirror is a negative scale */
export interface LaneMap {
  scale: number
  offset: number
}

const IDENTITY_LANE_MAP: LaneMap = { scale: 1, offset: 0 }

export interface OutlineLayer {
  kind: 'outline'
  key: string
  ribbon: RibbonLayer
}

/** `px` holds the ends in stack px, before the lane's map and the drag */
export interface BarLayer {
  kind: 'bars'
  key: string
  row: number
  top: number
  height: number
  domain: [number, number]
  origin: number
  start: number
  end: number
  px: readonly [number, number]
}

export type MultiWayLayer = RibbonLayer | GlyphLayer | OutlineLayer | BarLayer

export interface MultiWayRenderState extends FrameDimensions {
  dragOffsetPx: number
  /** the vertical twin of `dragOffsetPx`; every layer subtracts it */
  scrollTopPx: number
  hoveredFeatureId: number
  clickedFeatureId: number
  /** by lane row; an absent row is settled */
  laneMaps: ReadonlyMap<number, LaneMap>
  /** the band cells' `background.paper`, so a gutter matches the lane above */
  groundColor: string
  /** back to front, since the order is also the block order */
  layers: ReadonlyMap<number, MultiWayLayer>
}

export type MultiWayRenderingBackend = PerRegionRenderingBackend<
  MultiWayCell,
  MultiWayRenderState
>

export function laneMapOf(
  state: Pick<MultiWayRenderState, 'laneMaps'>,
  row: number | undefined,
) {
  return (
    (row === undefined ? undefined : state.laneMaps.get(row)) ??
    IDENTITY_LANE_MAP
  )
}

export function drawnPx(map: LaneMap, px: number) {
  return map.scale * px + map.offset
}

export function packedPx(map: LaneMap, px: number) {
  return (px - map.offset) / map.scale
}

export function ribbonParams(
  layer: RibbonLayer,
  state: MultiWayRenderState,
): SyntenyTrackRenderParams {
  const top = laneMapOf(state, layer.rows[0])
  const bottom = laneMapOf(state, layer.rows[1])
  return {
    yTop: layer.yTop - state.scrollTopPx,
    height: layer.height,
    alpha: 1,
    fadeThinAlignments: false,
    minAlignmentLength: 0,
    hoveredFeatureId: state.hoveredFeatureId,
    clickedFeatureId: state.clickedFeatureId,
    offsetPx0: -(top.offset + state.dragOffsetPx),
    offsetPx1: -(bottom.offset + state.dragOffsetPx),
    bpPerPx0: 1 / top.scale,
    bpPerPx1: 1 / bottom.scale,
    drawCurves: layer.curves,
  }
}

/** at 0, a flipped lane loses every ribbon crossing the canvas */
export const MULTIWAY_OVERDRAW_PX = DEFAULT_OVERDRAW_PX

/** a numeric key per gutter, topmost last */
export function ribbonPickState(
  state: MultiWayRenderState,
): SyntenyRenderState {
  const perTrack = new Map<number, SyntenyTrackRenderParams>()
  for (const [key, layer] of state.layers) {
    if (layer.kind === 'ribbons') {
      perTrack.set(key, ribbonParams(layer, state))
    }
  }
  return {
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
    overdrawPx: MULTIWAY_OVERDRAW_PX,
    groundColor: state.groundColor,
    perTrack,
  }
}

/** packed px; a reversed block is a lane drawn mirrored */
export function glyphBlockRange(layer: GlyphLayer, state: MultiWayRenderState) {
  const map = laneMapOf(state, layer.row)
  const shift = layer.scrolled ? state.dragOffsetPx : 0
  const reversed = map.scale < 0
  const start =
    PX_ORIGIN +
    ((reversed ? state.canvasWidth : 0) - map.offset - shift) / map.scale
  return {
    start,
    end: start + state.canvasWidth / Math.abs(map.scale),
    reversed,
  }
}
