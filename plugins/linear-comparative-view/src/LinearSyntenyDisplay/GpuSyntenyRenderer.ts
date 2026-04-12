import {
  EDGE_FRAGMENT_SHADER,
  EDGE_VERTEX_SHADER,
  FILL_FRAGMENT_SHADER,
  FILL_FRAGMENT_SHADER_PICKING,
  FILL_VERTEX_SHADER,
} from './glslShaders.ts'
import {
  EDGE_SEGMENTS,
  EDGE_VERTS_PER_INSTANCE,
  FILL_SEGMENTS,
  FILL_VERTS_PER_INSTANCE,
  INSTANCE_BYTE_SIZE,
  UNIFORM_BYTE_SIZE,
  edgeVertexShader,
  fillVertexShader,
  interleaveInstances,
} from './wgslShaders.ts'

import type { SyntenyBackend } from './syntenyBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_FILL = 'fill'
const PASS_PICKING = 'picking'
const PASS_EDGE = 'edge'
const REGION_KEY = 0

const INST_LAYOUT = [
  {
    name: 'a_inst0',
    components: 4,
    type: 'float' as const,
    offsetBytes: 0,
    integer: false,
  },
  {
    name: 'a_inst1',
    components: 1,
    type: 'uint' as const,
    offsetBytes: 16,
    integer: true,
  },
  {
    name: 'a_inst2',
    components: 4,
    type: 'float' as const,
    offsetBytes: 32,
    integer: false,
  },
  {
    name: 'a_inst3',
    components: 4,
    type: 'float' as const,
    offsetBytes: 48,
    integer: false,
  },
]

export const SYNTENY_PASSES: PassDescriptor[] = [
  {
    id: PASS_FILL,
    wgslSource: fillVertexShader,
    glslVertex: FILL_VERTEX_SHADER,
    glslFragment: FILL_FRAGMENT_SHADER,
    instanceStride: INSTANCE_BYTE_SIZE,
    verticesPerInstance: FILL_VERTS_PER_INSTANCE,
    blend: true,
    glAttributes: INST_LAYOUT,
  },
  {
    id: PASS_PICKING,
    wgslSource: fillVertexShader,
    wgslFragmentEntry: 'fs_picking',
    glslVertex: FILL_VERTEX_SHADER,
    glslFragment: FILL_FRAGMENT_SHADER,
    glslFragmentOverride: FILL_FRAGMENT_SHADER_PICKING,
    instanceStride: INSTANCE_BYTE_SIZE,
    verticesPerInstance: FILL_VERTS_PER_INSTANCE,
    blend: false,
    picking: true,
    glAttributes: INST_LAYOUT,
  },
  {
    id: PASS_EDGE,
    wgslSource: edgeVertexShader,
    glslVertex: EDGE_VERTEX_SHADER,
    glslFragment: EDGE_FRAGMENT_SHADER,
    instanceStride: INSTANCE_BYTE_SIZE,
    verticesPerInstance: EDGE_VERTS_PER_INSTANCE,
    blend: true,
    glAttributes: INST_LAYOUT,
  },
]

export class GpuSyntenyRenderer implements SyntenyBackend {
  private hal: GpuHal
  private canvas: HTMLCanvasElement
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)

  private instanceCount = 0
  private nonCigarInstanceCount = 0
  private geometryBpPerPx0 = 1
  private geometryBpPerPx1 = 1
  private refOffset0 = 0
  private refOffset1 = 0
  private pickingDirty = true

  private lastRenderParams = {
    height: 0,
    adjOff0: 0,
    adjOff1: 0,
    scale0: 1,
    scale1: 1,
    maxOffScreenPx: 300,
    minAlignmentLength: 0,
    alpha: 1,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
  }

  constructor(hal: GpuHal, canvas: HTMLCanvasElement) {
    this.hal = hal
    this.canvas = canvas
  }

  resize(width: number, height: number) {
    this.hal.resize(width, height)
  }

  uploadGeometry(data: SyntenyInstanceData) {
    this.instanceCount = data.instanceCount
    this.nonCigarInstanceCount = data.nonCigarInstanceCount
    this.geometryBpPerPx0 = data.geometryBpPerPx0
    this.geometryBpPerPx1 = data.geometryBpPerPx1
    this.refOffset0 = data.refOffset0
    this.refOffset1 = data.refOffset1

    const interleaved = interleaveInstances(data)

    // Upload once to PASS_FILL; PASS_PICKING shares the same buffer via drawPickingPass
    this.hal.uploadBuffer(
      REGION_KEY,
      PASS_FILL,
      interleaved,
      data.instanceCount,
    )
    this.hal.uploadBuffer(
      REGION_KEY,
      PASS_EDGE,
      interleaved,
      data.nonCigarInstanceCount,
    )
    this.pickingDirty = true
  }

  render(
    offset0: number,
    offset1: number,
    height: number,
    curBpPerPx0: number,
    curBpPerPx1: number,
    maxOffScreenPx: number,
    minAlignmentLength: number,
    alpha: number,
    hoveredFeatureId: number,
    clickedFeatureId: number,
  ) {
    if (this.instanceCount === 0) {
      this.hal.beginFrame(1, 1, 1, 1)
      this.hal.endFrame()
      return
    }

    const scale0 = this.geometryBpPerPx0 / curBpPerPx0
    const scale1 = this.geometryBpPerPx1 / curBpPerPx1
    const adjOff0 = offset0 / scale0 - this.refOffset0
    const adjOff1 = offset1 / scale1 - this.refOffset1

    this.lastRenderParams = {
      height,
      adjOff0,
      adjOff1,
      scale0,
      scale1,
      maxOffScreenPx,
      minAlignmentLength,
      alpha,
      hoveredFeatureId,
      clickedFeatureId,
    }
    this.pickingDirty = true

    this.writeUniforms(
      height,
      adjOff0,
      adjOff1,
      scale0,
      scale1,
      maxOffScreenPx,
      minAlignmentLength,
      alpha,
      hoveredFeatureId,
      clickedFeatureId,
    )

    this.hal.beginFrame(1, 1, 1, 1)
    this.hal.drawPass(PASS_FILL, REGION_KEY)
    if (clickedFeatureId > 0) {
      this.hal.drawPass(PASS_EDGE, REGION_KEY)
    }
    this.hal.endFrame()
  }

  pick(x: number, y: number, onResult?: (result: number) => void) {
    if (this.instanceCount === 0) {
      return -1
    }

    if (this.pickingDirty) {
      const p = this.lastRenderParams
      this.writeUniforms(
        p.height,
        p.adjOff0,
        p.adjOff1,
        p.scale0,
        p.scale1,
        p.maxOffScreenPx,
        p.minAlignmentLength,
        1,
        0,
        0,
      )
      this.hal.drawPickingPass(PASS_PICKING, REGION_KEY, undefined, PASS_FILL)
      this.pickingDirty = false
    }

    if (onResult) {
      this.hal.readPickingPixelAsync(x, y).then(onResult, () => {})
      return -1
    }
    return this.hal.readPickingPixel(x, y)
  }

  dispose() {
    this.hal.dispose()
  }

  private writeUniforms(
    height: number,
    adjOff0: number,
    adjOff1: number,
    scale0: number,
    scale1: number,
    maxOffScreenPx: number,
    minAlignmentLength: number,
    alpha: number,
    hoveredFeatureId: number,
    clickedFeatureId: number,
  ) {
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
    this.uniformF32[0] = this.canvas.width / dpr
    this.uniformF32[1] = this.canvas.height / dpr
    this.uniformF32[2] = height
    this.uniformF32[3] = adjOff0
    this.uniformF32[4] = adjOff1
    this.uniformF32[5] = scale0
    this.uniformF32[6] = scale1
    this.uniformF32[7] = maxOffScreenPx
    this.uniformF32[8] = minAlignmentLength
    this.uniformF32[9] = alpha
    this.uniformU32[10] = this.instanceCount
    this.uniformU32[11] = FILL_SEGMENTS
    this.uniformU32[12] = EDGE_SEGMENTS
    this.uniformF32[13] = hoveredFeatureId
    this.uniformF32[14] = clickedFeatureId
    this.uniformF32[15] = 0
    this.hal.writeUniforms(this.uniformData)
  }
}

export { UNIFORM_BYTE_SIZE as SYNTENY_UNIFORM_BYTE_SIZE } from './wgslShaders.ts'
