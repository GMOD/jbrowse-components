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
import { createInstanceCache } from '@jbrowse/render-core/instanceCache'
import { uploadPass } from '@jbrowse/render-core/instancePass'
import { GpuRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'

import {
  SYNTENY_PASSES,
  SYNTENY_UNIFORM_BYTE_SIZE,
  writeSyntenyUniforms,
} from '../LinearSyntenyDisplay/GpuSyntenyRenderer.ts'
import { SYNTENY_INSTANCE_CACHE } from '../LinearSyntenyDisplay/instanceInterleave.ts'
import { SyntenyGeometryCache } from '../LinearSyntenyDisplay/syntenyGeometryCache.ts'
import {
  makePickCtx,
  pickFeatureAtPoint,
} from '../LinearSyntenyDisplay/syntenyPickEngine.ts'
import {
  CellIds,
  ribbonPickResult,
  ribbonPickState,
} from './Canvas2DMultiWayRenderer.ts'
import { glyphRangeStart, ribbonParams } from './multiwayRenderTypes.ts'

import type { PickCanvasLike } from '../LinearSyntenyDisplay/syntenyPickEngine.ts'
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

const PASS_FILL_STRAIGHT = 'fillStraight'
const PASS_FILL_CURVE = 'fillCurve'

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
  private ids = new CellIds()
  private ribbons = new SyntenyGeometryCache()
  // Which fill pass each ribbon cell is uploaded against: only the mode a
  // layer draws in lives on the GPU, and a drawCurves toggle re-uploads on the
  // next frame from the packed bytes the interleave cache still holds.
  private uploadedPass = new Map<number, string>()
  private interleaveCache = createInstanceCache(SYNTENY_INSTANCE_CACHE)
  private pickCtx: PickCanvasLike | undefined

  constructor(hal: GpuHal, canvas: HTMLCanvasElement) {
    super(hal, MULTIWAY_UNIFORM_BYTE_SIZE)
    this.uniformF32 = new Float32Array(this.uniformData)
    this.canvas = canvas
  }

  resize(width: number, height: number) {
    this.hal.resize(width, height)
  }

  upload(key: string, cell: MultiWayCell) {
    const id = this.ids.of(key)
    this.cells.set(key, cell)
    this.hal.deleteRegion(id)
    this.uploadedPass.delete(id)
    if (cell.kind === 'ribbons') {
      this.ribbons.set(id, cell.data)
    } else {
      for (const pass of GLYPH_PASSES) {
        uploadPass(this.hal, id, pass, cell.data)
      }
    }
  }

  release(key: string) {
    const id = this.ids.of(key)
    this.cells.delete(key)
    this.ribbons.delete(id)
    this.uploadedPass.delete(id)
    this.interleaveCache.delete(id)
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
    const id = this.ids.of(layer.key)
    const data = this.ribbons.regions.get(id)
    if (!data || data.instanceCount === 0) {
      return
    }
    const pass = layer.curves ? PASS_FILL_CURVE : PASS_FILL_STRAIGHT
    const prev = this.uploadedPass.get(id)
    if (prev !== pass) {
      if (prev !== undefined) {
        this.hal.deleteBuffer(id, prev)
      }
      this.hal.uploadBuffer(
        id,
        pass,
        this.interleaveCache.get(id, data),
        data.instanceCount,
      )
      this.uploadedPass.set(id, pass)
    }
    const dpr = getDpr()
    writeSyntenyUniforms(this.uniformF32, ribbonParams(layer, state), 0, data, {
      width: state.width,
      height: state.height,
      dpr,
    })
    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(pass, id)
  }

  private drawGlyphs(
    layer: GlyphLayer,
    data: LaneGlyphData,
    state: MultiWayRenderState,
  ) {
    const id = this.ids.of(layer.key)
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
    this.pickCtx ??= makePickCtx()
    const ctx = this.pickCtx
    if (!ctx) {
      return undefined
    }
    return ribbonPickResult(
      pickFeatureAtPoint({
        ctx,
        state: ribbonPickState(state, key => this.ids.of(key)),
        regions: this.ribbons.regions,
        pickIndices: this.ribbons.pickIndices,
        canvasLogicalWidth: this.canvas.width / getDpr(),
        x,
        y,
      }),
      this.ids,
      this.ribbons.regions,
    )
  }

  override dispose() {
    this.cells.clear()
    this.ribbons.clear()
    this.interleaveCache.clear()
    super.dispose()
  }
}
