import { getContrastText } from '@jbrowse/core/ui/palette'
import { cssColorToRgb } from '@jbrowse/core/util/colorBits'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { createInstanceCache } from '@jbrowse/render-core/instanceCache'
import { GpuRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'
import { slangPass } from '@jbrowse/render-core/slangPass'

import {
  SYNTENY_INSTANCE_CACHE,
  packClickedOutlineInstances,
} from './instanceInterleave.ts'
import * as syntenyEdgeCurveShader from './shaders/syntenyEdgeCurve.generated.ts'
import * as syntenyEdgeStraightShader from './shaders/syntenyEdgeStraight.generated.ts'
import * as syntenyFillCurveShader from './shaders/syntenyFillCurve.generated.ts'
import * as syntenyFillStraightShader from './shaders/syntenyFillStraight.generated.ts'
import { SyntenyGeometryCache } from './syntenyGeometryCache.ts'
import { makePickCtx, pickFeatureAtPoint } from './syntenyPickEngine.ts'
import { computeTransform } from './syntenyRibbonPath.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { PickCanvasLike } from './syntenyPickEngine.ts'
import type {
  SyntenyRenderState,
  SyntenyRenderingBackend,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'

const PASS_FILL_STRAIGHT = 'fillStraight'
const PASS_FILL_CURVE = 'fillCurve'
const PASS_EDGE_STRAIGHT = 'edgeStraight'
const PASS_EDGE_CURVE = 'edgeCurve'

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
  // Which fill pass each region's GPU buffer is currently uploaded against.
  // Only one of {STRAIGHT, CURVE} lives on the GPU per region at a time;
  // flipping `drawCurves` re-uploads on the next render (reusing the packed
  // buffer — see interleaveCache). Trades a one-frame upload stall on toggle
  // for ~½ steady-state GPU memory.
  private uploadedPass = new Map<number, string>()
  // Packed interleaved bytes per region, re-packed only when the geometry
  // moves: a colorBy/opacity toggle patches the color lane and a drawCurves
  // toggle reuses the bytes verbatim, instead of re-interleaving all 12 lanes.
  private interleaveCache = createInstanceCache(SYNTENY_INSTANCE_CACHE)
  // What each region's clicked-outline buffer currently holds. Uploaded under
  // the EDGE pass id (the fill buffer keeps the fill pass id), so a region can
  // carry both at once. Every field is part of the invalidation key: the two
  // array identities catch an RPC refetch and a recolor, `featureId` a new
  // selection, `passId` a drawCurves toggle.
  private outlineBuffers = new Map<
    number,
    {
      geomToken: Float32Array
      colors: Uint32Array
      featureId: number
      passId: string
      count: number
    }
  >()
  private pickCtx: PickCanvasLike | undefined

  constructor(hal: GpuHal, canvas: HTMLCanvasElement) {
    // The base owns `hal`, the reusable uniform scratch, `dispose`, and the
    // `setErrorHandler` that routes a HAL over-limit allocation to renderError
    // — which is what puts the "too much data, zoom in" banner on an
    // all-vs-all band too big for the device, instead of a blank canvas.
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
    this.canvas = canvas
  }

  resize(width: number, height: number) {
    this.hal.resize(width, height)
  }

  upload(key: number, data: SyntenyInstanceData) {
    this.cache.set(key, data)
    // Defer the GPU upload to render() — at that point we know which mode
    // (straight vs curve) the track is in and upload only to that pass.
    const prev = this.uploadedPass.get(key)
    if (prev !== undefined) {
      this.hal.deleteBuffer(key, prev)
      this.uploadedPass.delete(key)
    }
    this.dropOutlineBuffer(key)
  }

  release(key: number) {
    this.cache.delete(key)
    this.uploadedPass.delete(key)
    this.interleaveCache.delete(key)
    this.outlineBuffers.delete(key)
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
      const fillPass = params.drawCurves ? PASS_FILL_CURVE : PASS_FILL_STRAIGHT
      this.ensureUploaded(key, fillPass, data)
      this.writeUniforms(params, state.overdrawPx, data, groundColor)
      this.hal.drawPass(fillPass, key)
      if (params.clickedFeatureId > 0) {
        // Edge pass outlines only the clicked feature's BASE silhouette, and
        // re-draws the active fill pass's own polygon from the same packed
        // instance record, so the outline traces the fill exactly. Drawn after
        // the fill so it layers above it.
        const edgePass = params.drawCurves
          ? PASS_EDGE_CURVE
          : PASS_EDGE_STRAIGHT
        if (
          this.ensureOutlineUploaded(
            key,
            edgePass,
            data,
            params.clickedFeatureId,
          )
        ) {
          this.hal.drawPass(edgePass, key)
        }
      }
    }
    this.hal.endFrame()
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
      this.interleaveCache.get(key, data),
      data.instanceCount,
    )
    this.uploadedPass.set(key, passId)
  }

  // Put the clicked feature's outline instances on the GPU under `passId`,
  // reusing what is already there when nothing in the key moved. Answers
  // whether there is anything to draw: a clicked feature whose instances all
  // live in another region packs to zero here, and the HAL leaves no buffer
  // behind for an empty upload.
  //
  // Uploaded from render() rather than the upload callback because the clicked
  // id is a RENDER parameter — nothing knows which feature to pack until the
  // frame that draws it. It reads the same packed bytes `ensureUploaded` just
  // put on the GPU, through the same `interleaveCache` memo, so the outline and
  // the fill are copies of one record and cannot describe different geometry.
  private ensureOutlineUploaded(
    key: number,
    passId: string,
    data: SyntenyInstanceData,
    featureId: number,
  ) {
    const prev = this.outlineBuffers.get(key)
    if (
      prev &&
      prev.geomToken === data.bp1 &&
      prev.colors === data.colors &&
      prev.featureId === featureId &&
      prev.passId === passId
    ) {
      return prev.count > 0
    }
    // A drawCurves toggle moves the outline to the other edge pass; the old
    // pass's buffer would otherwise sit on the GPU unreferenced. Same-pass
    // re-uploads need no delete — both HALs replace in place.
    if (prev && prev.passId !== passId) {
      this.hal.deleteBuffer(key, prev.passId)
    }
    const { buf, count } = packClickedOutlineInstances(
      data,
      featureId,
      this.interleaveCache.get(key, data),
    )
    this.hal.uploadBuffer(key, passId, buf, count)
    this.outlineBuffers.set(key, {
      geomToken: data.bp1,
      colors: data.colors,
      featureId,
      passId,
      count,
    })
    return count > 0
  }

  private dropOutlineBuffer(key: number) {
    const prev = this.outlineBuffers.get(key)
    if (prev) {
      this.hal.deleteBuffer(key, prev.passId)
      this.outlineBuffers.delete(key)
    }
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
    this.interleaveCache.clear()
    this.outlineBuffers.clear()
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
