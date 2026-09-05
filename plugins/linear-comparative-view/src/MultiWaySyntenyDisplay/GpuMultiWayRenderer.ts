import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
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
import {
  MULTIWAY_GLYPH_MARKS,
  glyphBlock,
  glyphFrame,
} from './multiwayGlyphMarks.ts'
import { ribbonParams } from './multiwayRenderTypes.ts'

import type {
  GlyphLayer,
  LaneGlyphData,
  MultiWayCell,
  MultiWayRenderState,
  MultiWayRenderingBackend,
  RibbonLayer,
} from './multiwayRenderTypes.ts'
import type { CanvasScale } from '@jbrowse/render-core/canvas2dUtils'
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'

/**
 * The synteny stack's four passes for the ribbons and ticks, and the feature
 * track's glyph marks' passes for the lanes. A region key holds a ribbon
 * cell's fill buffer or a lane cell's glyph buffers, never both.
 */
export const MULTIWAY_PASSES: PipelineDescriptor[] = [
  ...SYNTENY_PASSES,
  ...MULTIWAY_GLYPH_MARKS.map(m => m.pass),
]

export const MULTIWAY_UNIFORM_BYTE_SIZE = Math.max(
  SYNTENY_UNIFORM_BYTE_SIZE,
  ...MULTIWAY_GLYPH_MARKS.map(m => m.uniformByteSize),
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
      for (const mark of MULTIWAY_GLYPH_MARKS) {
        if (!mark.bufferOf) {
          uploadPass(this.hal, id, mark.pass, cell.data)
        }
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
    const scale = this.hal.resize(state.width, state.height)
    this.hal.beginFrame(0, 0, 0, 0)
    for (const layer of state.layers) {
      const cell = this.cells.get(layer.key)
      if (!cell) {
        continue
      }
      if (layer.kind === 'ribbons' && cell.kind === 'ribbons') {
        this.drawRibbons(layer, state)
      } else if (layer.kind === 'glyphs' && cell.kind === 'glyphs') {
        this.drawGlyphs(layer, cell.data, state, scale)
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
    scale: CanvasScale,
  ) {
    const block = glyphBlock(layer, state, this.ribbons.idOf(layer.key))
    const clip = clipBlock(block, state.width, state.height, scale)
    if (clip) {
      const frame = glyphFrame(state)
      for (const mark of MULTIWAY_GLYPH_MARKS) {
        mark.drawRegion(this.hal, this.uniformData, block, clip, data, frame)
      }
    }
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
