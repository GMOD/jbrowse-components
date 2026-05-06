import { slangPass } from '@jbrowse/core/gpu/slangPass'
import { splitPositionWithFrac } from '@jbrowse/core/gpu/webglUtils'

import { interleaveInstances } from './instanceInterleave.ts'
import * as syntenyEdgeShader from './shaders/syntenyEdge.generated.ts'
import * as syntenyFillShader from './shaders/syntenyFill.generated.ts'
import * as syntenyPickingShader from './shaders/syntenyPicking.generated.ts'

import type {
  SyntenyBackend,
  SyntenyPickResult,
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_FILL = 'fill'
const PASS_PICKING = 'picking'
const PASS_EDGE = 'edge'

const UNIFORMS_SIZE_BYTES = syntenyFillShader.UNIFORMS_SIZE_BYTES
const U = syntenyFillShader.UNIFORM_OFFSET_F32

export const SYNTENY_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_FILL,
    mod: syntenyFillShader,
  }),
  slangPass({
    id: PASS_PICKING,
    mod: syntenyPickingShader,
    blend: false,
    picking: true,
  }),
  slangPass({
    id: PASS_EDGE,
    mod: syntenyEdgeShader,
  }),
]

interface RegionMeta {
  instanceCount: number
  nonCigarInstanceCount: number
}

interface TrackState {
  key: number
  region: RegionMeta
  params: SyntenyTrackRenderParams
  maxOffScreenPx: number
}

function makeTrackState(
  key: number,
  region: RegionMeta,
  params: SyntenyTrackRenderParams,
  maxOffScreenPx: number,
): TrackState {
  return { key, region, params, maxOffScreenPx }
}

export class GpuSyntenyRenderer implements SyntenyBackend {
  private hal: GpuHal
  private canvas: HTMLCanvasElement
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)

  private regions = new Map<number, RegionMeta>()
  private tracks: TrackState[] = []

  // Serialize async picks: the HAL's readback uses a single staging buffer,
  // so concurrent mapAsync calls race (triggering WebGPU validation errors
  // and, on some drivers, a tab crash). We run at most one at a time and
  // coalesce rapid hover requests to the latest coords — intermediate
  // results are stale before they'd render.
  //
  // hoverGeneration guards against a race where the mouse leaves the canvas
  // while a readback is in flight: each call to pick() with a callback
  // captures the generation at call time; when the async result arrives it is
  // discarded if the generation has since advanced (i.e. a newer pick was
  // queued, typically the cancel-pick from handleMouseLeave).
  private inFlight: Promise<void> | undefined
  private nextPick:
    | {
        x: number
        y: number
        onResult: (result: SyntenyPickResult | undefined) => void
      }
    | undefined
  private hoverGeneration = 0
  private disposed = false

  constructor(hal: GpuHal, canvas: HTMLCanvasElement) {
    this.hal = hal
    this.canvas = canvas
  }

  resize(width: number, height: number) {
    this.hal.resize(width, height)
  }

  uploadGeometry(key: number, data: SyntenyInstanceData) {
    this.regions.set(key, {
      instanceCount: data.instanceCount,
      nonCigarInstanceCount: data.nonCigarInstanceCount,
    })
    const interleaved = interleaveInstances(data)
    this.hal.uploadBuffer(key, PASS_FILL, interleaved, data.instanceCount)
    this.hal.uploadBuffer(
      key,
      PASS_EDGE,
      interleaved,
      data.nonCigarInstanceCount,
    )
  }

  deleteGeometry(key: number) {
    this.regions.delete(key)
    this.hal.deleteRegion(key)
  }

  render(state: SyntenyRenderState) {
    if (this.regions.size === 0) {
      return false
    }
    this.hal.beginFrame(1, 1, 1, 1)
    this.tracks = []
    for (const [key, params] of state.perTrack) {
      const region = this.regions.get(key)
      if (!region || region.instanceCount === 0) {
        continue
      }
      const track = makeTrackState(key, region, params, state.maxOffScreenPx)
      this.tracks.push(track)
      this.writeUniforms(
        track,
        params.hoveredFeatureId,
        params.clickedFeatureId,
        params.alpha,
      )
      this.hal.drawPass(PASS_FILL, key)
      if (params.clickedFeatureId > 0) {
        this.hal.drawPass(PASS_EDGE, key)
      }
    }
    this.hal.endFrame()
    return true
  }

  pick(
    x: number,
    y: number,
    onResult?: (result: SyntenyPickResult | undefined) => void,
  ): SyntenyPickResult | undefined {
    if (this.disposed) {
      onResult?.(undefined)
      return undefined
    }
    if (!onResult) {
      // Sync path (click / context menu): no readback race to worry about.
      const track = this.trackAtY(y)
      if (!track) {
        return undefined
      }
      this.writeUniforms(track, 0, 0, 1)
      this.hal.drawPickingPass(PASS_PICKING, track.key, undefined, PASS_FILL)
      const idx = this.hal.readPickingPixel(x, y)
      return idx >= 0 ? { key: track.key, featureIndex: idx } : undefined
    }
    const thisGen = ++this.hoverGeneration
    this.nextPick = {
      x,
      y,
      onResult: result => {
        if (this.hoverGeneration === thisGen) {
          onResult(result)
        }
      },
    }
    this.drainPickQueue()
    return undefined
  }

  private drainPickQueue() {
    if (this.inFlight || !this.nextPick || this.disposed) {
      return
    }
    const { x, y, onResult } = this.nextPick
    this.nextPick = undefined
    const track = this.trackAtY(y)
    if (!track) {
      onResult(undefined)
      return
    }
    this.writeUniforms(track, 0, 0, 1)
    this.hal.drawPickingPass(PASS_PICKING, track.key, undefined, PASS_FILL)
    this.inFlight = this.hal
      .readPickingPixelAsync(x, y)
      .then(
        idx => (idx >= 0 ? { key: track.key, featureIndex: idx } : undefined),
        () => undefined,
      )
      .then(result => {
        this.inFlight = undefined
        if (this.disposed) {
          return
        }
        try {
          onResult(result)
        } catch (e) {
          console.error(e)
        }
        this.drainPickQueue()
      })
  }

  dispose() {
    this.disposed = true
    this.nextPick = undefined
    this.regions.clear()
    this.tracks = []
    this.hal.dispose()
  }

  private trackAtY(y: number) {
    for (const t of this.tracks) {
      const top = t.params.yTop
      if (y >= top && y < top + t.params.height) {
        return t
      }
    }
    return undefined
  }

  private writeUniforms(
    t: TrackState,
    hoveredFeatureId: number,
    clickedFeatureId: number,
    alpha: number,
  ) {
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
    const u = this.uniformF32
    const p = t.params
    u[U.resolution] = this.canvas.width / dpr
    u[U.resolution + 1] = this.canvas.height / dpr
    u[U.height] = p.height
    const [vb0Hi, vb0Lo] = splitPositionWithFrac(p.offsetPx0 * p.bpPerPx0)
    const [vb1Hi, vb1Lo] = splitPositionWithFrac(p.offsetPx1 * p.bpPerPx1)
    u[U.viewBp0Hi] = vb0Hi
    u[U.viewBp0Lo] = vb0Lo
    u[U.bpPerPxInv0] = 1 / p.bpPerPx0
    u[U.viewBp1Hi] = vb1Hi
    u[U.viewBp1Lo] = vb1Lo
    u[U.bpPerPxInv1] = 1 / p.bpPerPx1
    u[U.hpZero] = 0
    u[U.maxOffScreenPx] = t.maxOffScreenPx
    u[U.minAlignmentLength] = p.minAlignmentLength
    u[U.alpha] = alpha
    u[U.hoveredFeatureId] = hoveredFeatureId
    u[U.clickedFeatureId] = clickedFeatureId
    u[U.yTop] = p.yTop
    u[U.isCurve] = p.drawCurves ? 1 : 0
    this.hal.writeUniforms(this.uniformData)
  }
}

export { UNIFORMS_SIZE_BYTES as SYNTENY_UNIFORM_BYTE_SIZE }
