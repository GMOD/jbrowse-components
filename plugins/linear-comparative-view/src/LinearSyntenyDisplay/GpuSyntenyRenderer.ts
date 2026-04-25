import { slangPass } from '@jbrowse/core/gpu/slangPass'

import {
  EDGE_VERTS_PER_INSTANCE,
  FILL_VERTS_PER_INSTANCE,
  interleaveInstances,
} from './instanceInterleave.ts'
import * as syntenyEdgeShader from './shaders/syntenyEdge.generated.ts'
import * as syntenyFillShader from './shaders/syntenyFill.generated.ts'
import * as syntenyPickingShader from './shaders/syntenyPicking.generated.ts'

import type {
  SyntenyBackend,
  SyntenyPickResult,
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyBackendTypes.ts'
import type { ViewProjection } from '@jbrowse/core/util/bpProjection'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_FILL = 'fill'
const PASS_PICKING = 'picking'
const PASS_EDGE = 'edge'

const UNIFORMS_SIZE_BYTES = syntenyFillShader.UNIFORMS_SIZE_BYTES
const U = syntenyFillShader.UNIFORM_OFFSET_F32
const SLOTS = syntenyFillShader.UNIFORM_SLOT_ARRAYS

const MAX_REGIONS = SLOTS.regionOffsetA.length

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
}

interface TrackState {
  key: number
  region: RegionMeta
  params: SyntenyTrackRenderParams
  maxOffScreenPx: number
}

export class GpuSyntenyRenderer implements SyntenyBackend {
  private hal: GpuHal
  private canvas: HTMLCanvasElement
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)

  private regions = new Map<number, RegionMeta>()
  private tracks: TrackState[] = []

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
    this.hal.beginFrame(1, 1, 1, 1)
    this.tracks = []
    for (const [key, params] of state.perTrack) {
      const region = this.regions.get(key)
      if (!region || region.instanceCount === 0) {
        continue
      }
      const track: TrackState = {
        key,
        region,
        params,
        maxOffScreenPx: state.maxOffScreenPx,
      }
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

  private writeProjection(
    proj: ViewProjection,
    slotsU32: readonly number[],
    u: Float32Array,
  ) {
    const { regionOffsetPx } = proj
    const n = Math.min(regionOffsetPx.length, MAX_REGIONS)
    for (let i = 0; i < n; i++) {
      u[slotsU32[i]!] = regionOffsetPx[i]!
    }
    for (let i = n; i < MAX_REGIONS; i++) {
      u[slotsU32[i]!] = 0
    }
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
    u[U.bpPerPx0] = t.params.projTop.bpPerPx
    u[U.bpPerPx1] = t.params.projBot.bpPerPx
    u[U.maxOffScreenPx] = t.maxOffScreenPx
    u[U.minAlignmentLength] = t.params.minAlignmentLength
    u[U.alpha] = alpha
    u[U.hoveredFeatureId] = hoveredFeatureId
    u[U.clickedFeatureId] = clickedFeatureId
    u[U.yTop] = t.params.yTop
    u[U.isCurve] = t.params.drawCurves ? 1 : 0
    u[U.hpZero] = 0
    this.writeProjection(t.params.projTop, SLOTS.regionOffsetA, u)
    this.writeProjection(t.params.projBot, SLOTS.regionOffsetB, u)
    this.hal.writeUniforms(this.uniformData)
  }
}

export { UNIFORMS_SIZE_BYTES as SYNTENY_UNIFORM_BYTE_SIZE }
