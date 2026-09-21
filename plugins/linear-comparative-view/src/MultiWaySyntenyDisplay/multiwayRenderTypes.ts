import type { SyntenyTrackRenderParams } from '../LinearSyntenyDisplay/syntenyRenderingBackendTypes.ts'
import type { SyntenyOutlineChannels } from '../LinearSyntenyDisplay/syntenyRibbonMarks.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { PaintedFill } from './geneColor.ts'
import type { Feature } from '@jbrowse/core/util'
import type { RegionRenderData } from '@jbrowse/plugin-canvas'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { FrameDimensions } from '@jbrowse/render-core/renderingBackendBase'

/**
 * Every cell is stated in the render-origin px space the lane stack lays out
 * in: a ribbon corner is a px, and a glyph position is a px moved up by this
 * so it fits the passes' unsigned coordinate. A layer's transform is then the
 * one number a pan changes, `dragOffsetPx`.
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
  /** what the mark is filled with, which the gene key reads back */
  fill?: PaintedFill
}

export interface LaneGlyphData extends RegionRenderData {
  hits: GlyphHit[]
}

export interface RibbonTarget {
  feature: Feature
  groupKey?: string
  label: string
}

export type MultiWayCell =
  | { kind: 'ribbons'; data: SyntenyInstanceData }
  | ({ kind: 'outline' } & SyntenyOutlineChannels)
  | { kind: 'glyphs'; data: LaneGlyphData }

export interface RibbonLayer {
  kind: 'ribbons'
  key: string
  yTop: number
  height: number
  curves: boolean
  /** the lane rows its top and bottom edges ride, for their `LaneMap`s */
  rows: readonly [number, number]
}

export interface GlyphLayer {
  kind: 'glyphs'
  key: string
  scrolled: boolean
  /** the lane row it draws, for its `LaneMap`; none for the bands */
  row?: number
}

/**
 * Where a lane draws its cells: packed px `x` lands at `scale * x + offset`.
 * Identity for a settled lane; while a re-alignment, a rung change or a flip
 * runs, the map carries the lane from its old frame's picture to its new one
 * without repacking anything. A mirror is a negative scale.
 */
export interface LaneMap {
  scale: number
  offset: number
}

const IDENTITY_LANE_MAP: LaneMap = { scale: 1, offset: 0 }

/**
 * The outline of the clicked group in one gutter — its own layer beside the
 * ribbon layer it traces, so a selection re-uploads the records the outline
 * draws rather than the gutter's whole buffer.
 */
export interface OutlineLayer {
  kind: 'outline'
  key: string
  ribbon: RibbonLayer
}

export type MultiWayLayer = RibbonLayer | GlyphLayer | OutlineLayer

export interface MultiWayRenderState extends FrameDimensions {
  dragOffsetPx: number
  /**
   * how far the stack is scrolled inside the viewport — the vertical twin of
   * `dragOffsetPx`, 0 until the lane count pushes the stack past the track
   * height (`laneContentHeight`). Every layer subtracts it, bands included
   */
  scrollTopPx: number
  hoveredFeatureId: number
  clickedFeatureId: number
  /** by lane row, each moving lane's `LaneMap`; a row absent is settled */
  laneMaps: ReadonlyMap<number, LaneMap>
  /**
   * The stack's ground, which the ribbon gutters share with the linear band:
   * `drawSyntenyTrack` blends an indel wedge against it and the shaders bake it
   * into `u.ground`. The same `background.paper` the band cells are painted in
   * (`bandCell`), so a gutter and the lane above it agree.
   */
  groundColor: string
  /**
   * The stack back to front, under the key each layer's cell is uploaded
   * against — ordered, because it is also the block order, and keyed, because a
   * mark's `params` lens picks its layer by the block's own key.
   */
  layers: ReadonlyMap<number, MultiWayLayer>
}

/**
 * One canvas, a block per layer: the gutters' ribbons, the clicked outline over
 * whichever gutter carries it, and each lane's glyphs. Every cell is a region
 * of the per-region backend, keyed by `sharedBackendKey` off the layer's name.
 */
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

/**
 * The packed px a glyph layer's block spans over the canvas: the drag, for a
 * scrolled layer, and its lane's map, inverted — so a reversed block is a
 * lane drawn mirrored.
 */
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
