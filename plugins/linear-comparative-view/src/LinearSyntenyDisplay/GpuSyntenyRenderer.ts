import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as syntenyEdgeShader from './shaders/syntenyEdge.generated.ts'
import * as syntenyFillShader from './shaders/syntenyFill.generated.ts'
import * as syntenyPickingShader from './shaders/syntenyPicking.generated.ts'
import {
  EDGE_VERTS_PER_INSTANCE,
  FILL_VERTS_PER_INSTANCE,
  interleaveInstances,
} from './instanceInterleave.ts'

import type {
  SyntenyBackend,
  SyntenyPickResult,
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'
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
    verticesPerInstance: FILL_VERTS_PER_INSTANCE,
  }),
  slangPass({
    id: PASS_PICKING,
    mod: syntenyPickingShader,
    verticesPerInstance: FILL_VERTS_PER_INSTANCE,
    blend: false,
    picking: true,
  }),
  slangPass({
    id: PASS_EDGE,
    mod: syntenyEdgeShader,
    verticesPerInstance: EDGE_VERTS_PER_INSTANCE,
  }),
]

interface RegionMeta {
  instanceCount: number
  nonCigarInstanceCount: number
  geometryBpPerPx0: number
  geometryBpPerPx1: number
  refOffset0: number
  refOffset1: number
}

interface TrackState {
  key: number
  region: RegionMeta
  params: SyntenyTrackRenderParams
  adjOff0: number
  adjOff1: number
  scale0: number
  scale1: number
  maxOffScreenPx: number
}

function makeTrackState(
  key: number,
  region: RegionMeta,
  params: SyntenyTrackRenderParams,
  maxOffScreenPx: number,
): TrackState {
  const scale0 = region.geometryBpPerPx0 / params.bpPerPx0
  const scale1 = region.geometryBpPerPx1 / params.bpPerPx1
  return {
    key,
    region,
    params,
    scale0,
    scale1,
    adjOff0: params.offset0 / scale0 - region.refOffset0,
    adjOff1: params.offset1 / scale1 - region.refOffset1,
    maxOffScreenPx,
  }
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
  private inFlight: Promise<void> | undefined
  private nextPick:
    | {
        x: number
        y: number
        onResult: (result: SyntenyPickResult | undefined) => void
      }
    | undefined
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
      geometryBpPerPx0: data.geometryBpPerPx0,
      geometryBpPerPx1: data.geometryBpPerPx1,
      refOffset0: data.refOffset0,
      refOffset1: data.refOffset1,
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
    this.nextPick = { x, y, onResult }
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
        onResult(result)
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
    u[U.resolution] = this.canvas.width / dpr
    u[U.resolution + 1] = this.canvas.height / dpr
    u[U.height] = t.params.height
    u[U.adjOff0] = t.adjOff0
    u[U.adjOff1] = t.adjOff1
    u[U.scale0] = t.scale0
    u[U.scale1] = t.scale1
    u[U.maxOffScreenPx] = t.maxOffScreenPx
    u[U.minAlignmentLength] = t.params.minAlignmentLength
    u[U.alpha] = alpha
    u[U.hoveredFeatureId] = hoveredFeatureId
    u[U.clickedFeatureId] = clickedFeatureId
    u[U.yTop] = t.params.yTop
    this.hal.writeUniforms(this.uniformData)
  }
}

export { UNIFORMS_SIZE_BYTES as SYNTENY_UNIFORM_BYTE_SIZE }
