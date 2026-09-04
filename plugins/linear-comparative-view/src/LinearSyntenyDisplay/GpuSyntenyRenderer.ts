import { getContrastText } from '@jbrowse/core/ui/palette'
import { cssColorToRgb } from '@jbrowse/core/util/colorBits'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { GpuRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as syntenyEdgeCurveShader from './shaders/syntenyEdgeCurve.generated.ts'
import * as syntenyEdgeStraightShader from './shaders/syntenyEdgeStraight.generated.ts'
import * as syntenyFillCurveShader from './shaders/syntenyFillCurve.generated.ts'
import * as syntenyFillStraightShader from './shaders/syntenyFillStraight.generated.ts'
import { SyntenyGeometryCache } from './syntenyGeometryCache.ts'
import { makePickCtx, pickFeatureAtPoint } from './syntenyPickEngine.ts'
import {
  PASS_EDGE_CURVE,
  PASS_EDGE_STRAIGHT,
  PASS_FILL_CURVE,
  PASS_FILL_STRAIGHT,
  SyntenyRibbonBuffers,
} from './syntenyRibbonBuffers.ts'
import { computeTransform } from './syntenyRibbonPath.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { PickCanvasLike } from './syntenyPickEngine.ts'
import type {
  SyntenyRenderState,
  SyntenyRenderingBackend,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'

// All four shaders share the same Uniforms layout (defined in
// syntenyTypes.slang) and the same Instance layout, so any shader's
// generated module is a valid source of these constants.
const UNIFORMS_SIZE_BYTES = syntenyFillStraightShader.UNIFORMS_SIZE_BYTES
const U = syntenyFillStraightShader.UNIFORM_OFFSET_F32

// Each edge pass carries its own buffer — the clicked feature's instances
// alone, from packClickedOutlineInstances — so it takes its stride and
// attributes from its own generated module like any other pass. It used to
// borrow the fill pass's buffer via `drawPass`'s `bufferPassId`, which is what
// the `bufferStride`/`bufferAttributes` overrides were for. All four modules
// declare the same `Instance` struct out of syntenyTypes.slang and
// syntenyPassGeometry.test.ts pins that, so the packed bytes are readable by
// either pass of a mode regardless.
export const SYNTENY_PASSES: PipelineDescriptor[] = [
  slangPass({ id: PASS_FILL_STRAIGHT, mod: syntenyFillStraightShader }),
  slangPass({ id: PASS_FILL_CURVE, mod: syntenyFillCurveShader }),
  slangPass({ id: PASS_EDGE_STRAIGHT, mod: syntenyEdgeStraightShader }),
  slangPass({ id: PASS_EDGE_CURVE, mod: syntenyEdgeCurveShader }),
]

export class GpuSyntenyRenderer
  extends GpuRenderingBackendBase
  implements SyntenyRenderingBackend
{
  // Held for the pick path, which measures against the element's own size. The
  // GPU base owns everything else.
  private canvas: HTMLCanvasElement
  private uniformF32: Float32Array

  private cache = new SyntenyGeometryCache()
  private buffers: SyntenyRibbonBuffers
  private pickCtx: PickCanvasLike | undefined

  constructor(hal: GpuHal, canvas: HTMLCanvasElement) {
    // The base owns `hal`, the reusable uniform scratch, `dispose`, and the
    // `setErrorHandler` that routes a HAL over-limit allocation to renderError
    // — which is what puts the "too much data, zoom in" banner on an
    // all-vs-all band too big for the device, instead of a blank canvas.
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
    this.canvas = canvas
    this.buffers = new SyntenyRibbonBuffers(this.hal)
  }

  resize(width: number, height: number) {
    this.hal.resize(width, height)
  }

  upload(key: number, data: SyntenyInstanceData) {
    this.cache.set(key, data)
    // Defer the GPU upload to render() — at that point we know which mode
    // (straight vs curve) the track is in and upload only to that pass.
    this.buffers.invalidate(key)
  }

  release(key: number) {
    this.cache.delete(key)
    this.buffers.release(key)
    this.hal.deleteRegion(key)
  }

  render(state: SyntenyRenderState) {
    // Opaque, where every other backend in the tree clears to (0,0,0,0).
    // `shadeFill` pre-blends a CIGAR indel with `u.ground` and outputs it
    // opaque, so it matches the base ribbon beside it — drawn at alpha `shade`
    // — only over a destination that IS the ground. This clear and the uniform
    // below come off the same `state.groundColor`, which is what holds that.
    // `Canvas2DSyntenyRenderer.clear` carries the whole argument, and the
    // Canvas2D twin of the pre-blend it rests on.
    const { groundColor } = state
    const [gr, gg, gb] = cssColorToRgb(groundColor)
    this.hal.beginFrame(gr / 255, gg / 255, gb / 255, 1)
    for (const [key, params] of state.perTrack) {
      const data = this.cache.regions.get(key)
      if (!data || data.instanceCount === 0) {
        continue
      }
      const fillPass = this.buffers.ensureFill(key, params.drawCurves, data)
      this.writeUniforms(params, state.overdrawPx, data, groundColor)
      this.hal.drawPass(fillPass, key)
      if (params.clickedFeatureId > 0) {
        // Edge pass outlines only the clicked feature's BASE silhouette, and
        // re-draws the active fill pass's own polygon from the same packed
        // instance record, so the outline traces the fill exactly. Drawn after
        // the fill so it layers above it.
        const edgePass = this.buffers.ensureOutline(
          key,
          params.drawCurves,
          data,
          params.clickedFeatureId,
        )
        if (edgePass) {
          this.hal.drawPass(edgePass, key)
        }
      }
    }
    this.hal.endFrame()
  }

  pick(x: number, y: number, state: SyntenyRenderState) {
    this.pickCtx ??= makePickCtx()
    const ctx = this.pickCtx
    if (!ctx) {
      return undefined
    }
    const dpr = getDpr()
    return pickFeatureAtPoint({
      ctx,
      state,
      regions: this.cache.regions,
      pickIndices: this.cache.pickIndices,
      canvasLogicalWidth: this.canvas.width / dpr,
      x,
      y,
    })
  }

  override dispose() {
    this.cache.clear()
    this.buffers.clear()
    super.dispose()
  }

  private writeUniforms(
    p: SyntenyTrackRenderParams,
    overdrawPx: number,
    data: SyntenyInstanceData,
    groundColor: string,
  ) {
    const dpr = getDpr()
    writeSyntenyUniforms(
      this.uniformF32,
      p,
      overdrawPx,
      data,
      {
        width: this.canvas.width / dpr,
        height: this.canvas.height / dpr,
        dpr,
      },
      groundColor,
    )
    this.hal.writeUniforms(this.uniformData)
  }
}

/**
 * The synteny passes' uniform block for one track, from its render params.
 * Shared with the multi-way display, whose GPU backend draws its ribbons and
 * ticks through the same four passes.
 */
export function writeSyntenyUniforms(
  u: Float32Array,
  p: SyntenyTrackRenderParams,
  overdrawPx: number,
  data: { base0: number; base1: number },
  canvas: { width: number; height: number; dpr: number },
  groundColor: string,
) {
  u[U.resolution] = canvas.width
  u[U.resolution + 1] = canvas.height
  // Floored here rather than in each shader — see the Uniforms.height note in
  // syntenyTypes.slang. A zero-height ribbon would divide by it.
  u[U.height] = Math.max(p.height, 1)
  // panPx = (base - offsetPx*bpPerPx)/bpPerPx: how far the current view has
  // panned from the fetch-time base, in px. Computed float64 from a SMALL
  // numerator (base ≈ the fetch-time viewport start), so no genome-scale
  // magnitude is multiplied by the rounded inv — that's what lets a single
  // Float32 corner stay sub-pixel. Shared with the CPU draw + pick paths
  // (computeTransform) so the two cannot drift; the shader consumes exactly
  // these four numbers in computeCorners (syntenyTypes.slang).
  const t = computeTransform(p, data)
  u[U.panPx0] = t.panPx0
  u[U.bpPerPxInv0] = t.bpPerPxInv0
  u[U.panPx1] = t.panPx1
  u[U.bpPerPxInv1] = t.bpPerPxInv1
  u[U.overdrawPx] = overdrawPx
  u[U.minAlignmentLength] = p.minAlignmentLength
  u[U.alpha] = p.alpha
  u[U.hoveredFeatureId] = p.hoveredFeatureId
  u[U.clickedFeatureId] = p.clickedFeatureId
  u[U.yTop] = p.yTop
  u[U.fadeThinAlignments] = p.fadeThinAlignments ? 1 : 0
  // The shaders measure in CSS px but rasterize on the device-px grid, so
  // they need the ratio to size their AA ramps at one output pixel. Must be
  // the same getDpr() the resolution above is derived from.
  u[U.devicePixelRatio] = canvas.dpr
  // The band's own two colours, 0-1 rgb. `ground` must be what the caller just
  // cleared to — shadeFill bakes it into every indel wedge — and `ink` is what
  // the edge pass strokes the clicked outline in, contrast-derived so a dark
  // band gets a light outline rather than an invisible black one.
  const [gr, gg, gb] = cssColorToRgb(groundColor)
  u[U.ground] = gr / 255
  u[U.ground + 1] = gg / 255
  u[U.ground + 2] = gb / 255
  const [ir, ig, ib] = cssColorToRgb(getContrastText(groundColor))
  u[U.ink] = ir / 255
  u[U.ink + 1] = ig / 255
  u[U.ink + 2] = ib / 255
}

export { UNIFORMS_SIZE_BYTES as SYNTENY_UNIFORM_BYTE_SIZE }
