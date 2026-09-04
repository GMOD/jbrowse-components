import type { SyntenyTrackRenderParams } from '../LinearSyntenyDisplay/syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { Feature } from '@jbrowse/core/util'
import type { RegionRenderData } from '@jbrowse/plugin-canvas'
import type { RenderingBackend } from '@jbrowse/render-core/renderingBackendBase'

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
  | { kind: 'glyphs'; data: LaneGlyphData }

export interface RibbonLayer {
  kind: 'ribbons'
  key: string
  yTop: number
  height: number
  curves: boolean
}

export interface GlyphLayer {
  kind: 'glyphs'
  key: string
  scrolled: boolean
}

export type MultiWayLayer = RibbonLayer | GlyphLayer

export interface MultiWayRenderState {
  width: number
  height: number
  dragOffsetPx: number
  /**
   * how far the stack is scrolled inside the viewport — the vertical twin of
   * `dragOffsetPx`, 0 until the lane count pushes the stack past the track
   * height (`laneContentHeight`). Every layer subtracts it, bands included
   */
  scrollTopPx: number
  hoveredFeatureId: number
  clickedFeatureId: number
  /**
   * The stack's ground, which the ribbon gutters share with the linear band:
   * `drawSyntenyTrack` blends an indel wedge against it and the shaders bake it
   * into `u.ground`. The same `background.paper` the band cells are painted in
   * (`bandCell`), so a gutter and the lane above it agree.
   */
  groundColor: string
  layers: MultiWayLayer[]
}

export interface MultiWayRibbonPick {
  key: string
  instanceIndex: number
  targetIdx: number
}

export interface MultiWayRenderingBackend extends RenderingBackend {
  resize(width: number, height: number): void
  upload(key: string, cell: MultiWayCell): void
  release(key: string): void
  render(state: MultiWayRenderState): boolean
  pickRibbon(
    x: number,
    y: number,
    state: MultiWayRenderState,
  ): MultiWayRibbonPick | undefined
}

export function ribbonParams(
  layer: RibbonLayer,
  state: MultiWayRenderState,
): SyntenyTrackRenderParams {
  return {
    yTop: layer.yTop - state.scrollTopPx,
    height: layer.height,
    alpha: 1,
    fadeThinAlignments: false,
    minAlignmentLength: 0,
    hoveredFeatureId: state.hoveredFeatureId,
    clickedFeatureId: state.clickedFeatureId,
    offsetPx0: -state.dragOffsetPx,
    offsetPx1: -state.dragOffsetPx,
    bpPerPx0: 1,
    bpPerPx1: 1,
    drawCurves: layer.curves,
  }
}

export function glyphRangeStart(layer: GlyphLayer, state: MultiWayRenderState) {
  return PX_ORIGIN - (layer.scrolled ? state.dragOffsetPx : 0)
}
