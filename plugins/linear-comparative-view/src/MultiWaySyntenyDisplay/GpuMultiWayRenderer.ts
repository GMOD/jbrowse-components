import {
  ARROW_PASS,
  ArrowPass,
  CHEVRON_PASS,
  FEATURE_GLYPH_UNIFORM_BYTE_SIZE,
  LINE_PASS,
  LinePass,
  MAX_VISIBLE_CHEVRONS_PER_LINE,
  RECT_PASS,
  RectPass,
  featureGlyphShader,
  makeChevronPass,
  packArrows,
  packLines,
  packRects,
} from '@jbrowse/plugin-canvas'
import { splitPositionWithFrac } from '@jbrowse/render-core/blockClipUtils'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { uploadPass } from '@jbrowse/render-core/instancePass'
import { GpuRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'

import {
  SYNTENY_PASSES,
  SYNTENY_UNIFORM_BYTE_SIZE,
  writeSyntenyUniforms,
} from '../LinearSyntenyDisplay/GpuSyntenyRenderer.ts'
import { SyntenyRibbonBuffers } from '../LinearSyntenyDisplay/syntenyRibbonBuffers.ts'
import { RibbonPickCells } from './Canvas2DMultiWayRenderer.ts'
import { glyphRangeStart, ribbonParams } from './multiwayRenderTypes.ts'

import type {
  GlyphLayer,
  LaneGlyphData,
  MultiWayCell,
  MultiWayRenderState,
  MultiWayRenderingBackend,
  RibbonLayer,
} from './multiwayRenderTypes.ts'
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'
import type { InstancePass } from '@jbrowse/render-core/instancePass'

const RECT_INSTANCES: InstancePass<LaneGlyphData> = {
  ...RectPass,
  pack: data =>
    packRects(
      {
        startEnd: data.rectPositions,
        y: data.rectYs,
        height: data.rectHeights,
        color: data.rectColors,
        densityFade: data.rectDensityFade,
        strand: data.rectStrands,
      },
      data.rectYs.length,
    ),
}
const LINE_INSTANCES: InstancePass<LaneGlyphData> = {
  ...LinePass,
  pack: data =>
    packLines(
      {
        startEnd: data.linePositions,
        y: data.lineYs,
        height: data.lineHeights,
        direction: data.lineDirections,
        color: data.lineColors,
      },
      data.lineYs.length,
    ),
}
const ARROW_INSTANCES: InstancePass<LaneGlyphData> = {
  ...ArrowPass,
  pack: data =>
    packArrows(
      {
        x: data.arrowXs,
        y: data.arrowYs,
        height: data.arrowHeights,
        widthBp: data.arrowWidthsBp,
        direction: data.arrowDirections,
        color: data.arrowColors,
      },
      data.arrowYs.length,
    ),
}
const GLYPH_PASSES = [RECT_INSTANCES, LINE_INSTANCES, ARROW_INSTANCES]

/**
 * The synteny stack's four passes for the ribbons and ticks, and the feature
 * track's glyph passes for the lanes. Every pass owns its buffer, so one
 * region key holds a ribbon cell's fill buffer or a lane cell's three glyph
 * buffers, never both.
 */
export const MULTIWAY_PASSES: PipelineDescriptor[] = [
  ...SYNTENY_PASSES,
  ...GLYPH_PASSES,
  makeChevronPass(MAX_VISIBLE_CHEVRONS_PER_LINE),
]

export const MULTIWAY_UNIFORM_BYTE_SIZE = Math.max(
  SYNTENY_UNIFORM_BYTE_SIZE,
  FEATURE_GLYPH_UNIFORM_BYTE_SIZE,
)

export class GpuMultiWayRenderer
  extends GpuRenderingBackendBase
  implements MultiWayRenderingBackend
{
  private canvas: HTMLCanvasElement
  private uniformF32: Float32Array
  private cells = new Map<string, MultiWayCell>()
  private ribbons = new RibbonPickCells()
  private buffers: SyntenyRibbonBuffers

  constructor(hal: GpuHal, canvas: HTMLCanvasElement) {
    super(hal, MULTIWAY_UNIFORM_BYTE_SIZE)
    this.uniformF32 = new Float32Array(this.uniformData)
    this.canvas = canvas
    this.buffers = new SyntenyRibbonBuffers(this.hal)
  }

  resize(width: number, height: number) {
    this.hal.resize(width, height)
  }

  upload(key: string, cell: MultiWayCell) {
    const id = this.ribbons.idOf(key)
    this.cells.set(key, cell)
    this.buffers.invalidate(id)
    this.hal.deleteRegion(id)
    if (cell.kind === 'ribbons') {
      this.ribbons.set(key, cell.data)
    } else {
      for (const pass of GLYPH_PASSES) {
        uploadPass(this.hal, id, pass, cell.data)
      }
    }
  }

  release(key: string) {
    const id = this.ribbons.idOf(key)
    this.cells.delete(key)
    this.ribbons.delete(key)
    this.buffers.release(id)
    this.hal.deleteRegion(id)
  }

  render(state: MultiWayRenderState) {
    this.hal.resize(state.width, state.height)
    this.hal.beginFrame(0, 0, 0, 0)
    for (const layer of state.layers) {
      const cell = this.cells.get(layer.key)
      if (!cell) {
        continue
      }
      if (layer.kind === 'ribbons' && cell.kind === 'ribbons') {
        this.drawRibbons(layer, state)
      } else if (layer.kind === 'glyphs' && cell.kind === 'glyphs') {
        this.drawGlyphs(layer, cell.data, state)
      }
    }
    this.hal.endFrame()
    return true
  }

  private drawRibbons(layer: RibbonLayer, state: MultiWayRenderState) {
    const id = this.ribbons.idOf(layer.key)
    const data = this.ribbons.geometry.regions.get(id)
    if (!data || data.instanceCount === 0) {
      return
    }
    const params = ribbonParams(layer, state)
    const pass = this.buffers.ensureFill(id, layer.curves, data)
    const dpr = getDpr()
    writeSyntenyUniforms(
      this.uniformF32,
      params,
      0,
      data,
      { width: state.width, height: state.height, dpr },
      state.groundColor,
    )
    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(pass, id)
    if (params.clickedFeatureId > 0) {
      // the pairwise display's clicked outline: the edge pass re-draws the
      // clicked ribbon's polygon from the same packed record, above the fill
      const edgePass = this.buffers.ensureOutline(
        id,
        layer.curves,
        data,
        params.clickedFeatureId,
      )
      if (edgePass) {
        this.hal.drawPass(edgePass, id)
      }
    }
  }

  private drawGlyphs(
    layer: GlyphLayer,
    data: LaneGlyphData,
    state: MultiWayRenderState,
  ) {
    const id = this.ribbons.idOf(layer.key)
    const [hi, lo] = splitPositionWithFrac(glyphRangeStart(layer, state))
    featureGlyphShader.writeUniforms(this.uniformData, {
      bpRangeX: [hi, lo, state.width],
      canvasHeight: state.height,
      canvasWidth: state.width,
      scrollY: 0,
      bpPerPx: 1,
      zero: 0,
      reversed: 0,
      outlineColor: data.outlineColor,
      leftIsCanvasEdge: 0,
      rightIsCanvasEdge: 0,
    })
    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(LINE_PASS, id)
    this.hal.drawPass(CHEVRON_PASS, id, LINE_PASS)
    this.hal.drawPass(RECT_PASS, id)
    this.hal.drawPass(ARROW_PASS, id)
  }

  pickRibbon(x: number, y: number, state: MultiWayRenderState) {
    return this.ribbons.pick(x, y, state, this.canvas.width / getDpr())
  }

  override dispose() {
    this.cells.clear()
    this.ribbons.clear()
    this.buffers.clear()
    super.dispose()
  }
}
