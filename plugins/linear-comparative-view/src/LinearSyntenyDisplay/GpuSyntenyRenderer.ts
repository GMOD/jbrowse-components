import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { slangPass } from '@jbrowse/render-core/slangPass'

import {
  interleaveInstances,
  patchInstanceColors,
} from './instanceInterleave.ts'
import * as syntenyEdgeCurveShader from './shaders/syntenyEdgeCurve.generated.ts'
import * as syntenyEdgeStraightShader from './shaders/syntenyEdgeStraight.generated.ts'
import * as syntenyFillCurveShader from './shaders/syntenyFillCurve.generated.ts'
import * as syntenyFillStraightShader from './shaders/syntenyFillStraight.generated.ts'
import { SyntenyGeometryCache } from './syntenyGeometryCache.ts'
import { pickFeatureAtPoint } from './syntenyPickEngine.ts'

import type {
  SyntenyRenderState,
  SyntenyRenderingBackend,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'

const PASS_FILL_STRAIGHT = 'fillStraight'
const PASS_FILL_CURVE = 'fillCurve'
const PASS_EDGE_STRAIGHT = 'edgeStraight'
const PASS_EDGE_CURVE = 'edgeCurve'

// All four shaders share the same Uniforms layout (defined in
// syntenyTypes.slang) and the same Instance layout, so any shader's
// generated module is a valid source of these constants.
const UNIFORMS_SIZE_BYTES = syntenyFillStraightShader.UNIFORMS_SIZE_BYTES
const U = syntenyFillStraightShader.UNIFORM_OFFSET_F32

export const SYNTENY_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS_FILL_STRAIGHT, mod: syntenyFillStraightShader }),
  slangPass({ id: PASS_FILL_CURVE, mod: syntenyFillCurveShader }),
  // Edge passes read the fill pass's instance buffer (uploaded under that
  // pass id) — same Instance layout in both, so attribute layout matches.
  slangPass({
    id: PASS_EDGE_STRAIGHT,
    mod: syntenyEdgeStraightShader,
    bufferStride: syntenyFillStraightShader.INSTANCE_STRIDE_BYTES,
    bufferAttributes: syntenyFillStraightShader.GL_ATTRIBUTES,
  }),
  slangPass({
    id: PASS_EDGE_CURVE,
    mod: syntenyEdgeCurveShader,
    bufferStride: syntenyFillCurveShader.INSTANCE_STRIDE_BYTES,
    bufferAttributes: syntenyFillCurveShader.GL_ATTRIBUTES,
  }),
]

// 1×1 offscreen 2D context used solely to evaluate isPointInPath during CPU
// pick — the path is rebuilt per candidate and never composited, so size
// doesn't matter. Lazily created on first pick.
function makePickCtx(): CanvasRenderingContext2D | undefined {
  if (typeof OffscreenCanvas !== 'undefined') {
    const ctx = new OffscreenCanvas(1, 1).getContext('2d')
    if (ctx) {
      return ctx as unknown as CanvasRenderingContext2D
    }
  }
  if (typeof document !== 'undefined') {
    return document.createElement('canvas').getContext('2d') ?? undefined
  }
  return undefined
}

export class GpuSyntenyRenderer implements SyntenyRenderingBackend {
  private hal: GpuHal
  private canvas: HTMLCanvasElement
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)

  private cache = new SyntenyGeometryCache()
  // Which fill pass each region's GPU buffer is currently uploaded against.
  // Only one of {STRAIGHT, CURVE} lives on the GPU per region at a time;
  // flipping `drawCurves` re-uploads on the next render (reusing the packed
  // buffer — see interleaveCache). Trades a one-frame upload stall on toggle
  // for ~½ steady-state GPU memory.
  private uploadedPass = new Map<number, string>()
  // Packed interleaved buffer per region, reused across re-uploads that don't
  // change geometry. `geomToken` is one of the geometry arrays (all replaced
  // atomically on RPC refetch); while it holds, a colorBy/opacity toggle only
  // patches the color lane and a drawCurves toggle reuses the bytes verbatim,
  // instead of re-interleaving all 12 lanes.
  private interleaveCache = new Map<
    number,
    { geomToken: Float32Array; colors: Uint32Array; buf: ArrayBuffer }
  >()
  private pickCtx: CanvasRenderingContext2D | undefined

  constructor(hal: GpuHal, canvas: HTMLCanvasElement) {
    this.hal = hal
    this.canvas = canvas
  }

  resize(width: number, height: number) {
    this.hal.resize(width, height)
  }

  uploadGeometry(key: number, data: SyntenyInstanceData) {
    this.cache.set(key, data)
    // Defer the GPU upload to render() — at that point we know which mode
    // (straight vs curve) the track is in and upload only to that pass.
    const prev = this.uploadedPass.get(key)
    if (prev !== undefined) {
      this.hal.deleteBuffer(key, prev)
      this.uploadedPass.delete(key)
    }
  }

  deleteGeometry(key: number) {
    this.cache.delete(key)
    this.uploadedPass.delete(key)
    this.interleaveCache.delete(key)
    this.hal.deleteRegion(key)
  }

  render(state: SyntenyRenderState) {
    if (this.cache.regions.size === 0) {
      return false
    }
    this.hal.beginFrame(1, 1, 1, 1)
    for (const [key, params] of state.perTrack) {
      const data = this.cache.regions.get(key)
      if (!data || data.instanceCount === 0) {
        continue
      }
      const fillPass = params.drawCurves ? PASS_FILL_CURVE : PASS_FILL_STRAIGHT
      this.ensureUploaded(key, fillPass, data)
      this.writeUniforms(params, state.overdrawPx, data)
      this.hal.drawPass(fillPass, key)
      if (params.clickedFeatureId > 0) {
        // Edge pass only outlines the clicked feature's BASE silhouette
        // (CIGAR tiles are culled in-shader via the `kind >= 3.0` check);
        // it reads the active fill pass's instance buffer.
        const edgePass = params.drawCurves
          ? PASS_EDGE_CURVE
          : PASS_EDGE_STRAIGHT
        this.hal.drawPass(edgePass, key, fillPass)
      }
    }
    this.hal.endFrame()
    return true
  }

  private ensureUploaded(
    key: number,
    passId: string,
    data: SyntenyInstanceData,
  ) {
    const prev = this.uploadedPass.get(key)
    if (prev === passId) {
      return
    }
    if (prev !== undefined) {
      this.hal.deleteBuffer(key, prev)
    }
    this.hal.uploadBuffer(
      key,
      passId,
      this.getInterleaved(key, data),
      data.instanceCount,
    )
    this.uploadedPass.set(key, passId)
  }

  // Packed instance bytes for a region, reusing the cached buffer when the
  // geometry is unchanged. A recolor (new `colors`, same geometry arrays)
  // patches only the color lane; a drawCurves toggle returns the bytes as-is.
  private getInterleaved(key: number, data: SyntenyInstanceData): ArrayBuffer {
    const cached = this.interleaveCache.get(key)
    if (cached?.geomToken === data.bp1) {
      if (cached.colors !== data.colors) {
        patchInstanceColors(cached.buf, data.colors)
        cached.colors = data.colors
      }
      return cached.buf
    }
    const buf = interleaveInstances(data)
    this.interleaveCache.set(key, {
      geomToken: data.bp1,
      colors: data.colors,
      buf,
    })
    return buf
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

  dispose() {
    this.cache.clear()
    this.interleaveCache.clear()
    this.hal.dispose()
  }

  private writeUniforms(
    p: SyntenyTrackRenderParams,
    overdrawPx: number,
    data: SyntenyInstanceData,
  ) {
    const dpr = getDpr()
    const u = this.uniformF32
    u[U.resolution] = this.canvas.width / dpr
    u[U.resolution + 1] = this.canvas.height / dpr
    u[U.height] = p.height
    // panPx = (base - offsetPx*bpPerPx)/bpPerPx: how far the current view has
    // panned from the fetch-time base, in px. Computed float64 from a SMALL
    // numerator (base ≈ the fetch-time viewport start), so no genome-scale
    // magnitude is multiplied by the rounded inv — that's what lets a single
    // Float32 corner stay sub-pixel. SYNC: matches computeTransform in
    // syntenyPickEngine and computeCorners in syntenyTypes.slang.
    u[U.panPx0] = (data.base0 - p.offsetPx0 * p.bpPerPx0) / p.bpPerPx0
    u[U.bpPerPxInv0] = 1 / p.bpPerPx0
    u[U.panPx1] = (data.base1 - p.offsetPx1 * p.bpPerPx1) / p.bpPerPx1
    u[U.bpPerPxInv1] = 1 / p.bpPerPx1
    u[U.overdrawPx] = overdrawPx
    u[U.minAlignmentLength] = p.minAlignmentLength
    u[U.alpha] = p.alpha
    u[U.hoveredFeatureId] = p.hoveredFeatureId
    u[U.clickedFeatureId] = p.clickedFeatureId
    u[U.yTop] = p.yTop
    u[U.fadeThinAlignments] = p.fadeThinAlignments ? 1 : 0
    this.hal.writeUniforms(this.uniformData)
  }
}

export { UNIFORMS_SIZE_BYTES as SYNTENY_UNIFORM_BYTE_SIZE }
