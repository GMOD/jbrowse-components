/// <reference types="@webgpu/types" />
import GpuHandlerType from '@jbrowse/core/pluggableElementTypes/GpuHandlerType'

import {
  EDGE_SEGMENTS,
  EDGE_VERTS_PER_INSTANCE,
  FILL_SEGMENTS,
  FILL_VERTS_PER_INSTANCE,
  INSTANCE_BYTE_SIZE,
  edgeVertexShader,
  fillVertexShader,
} from './LinearSyntenyDisplay/syntenyShaders.ts'

import type { GpuCanvasContext } from '@jbrowse/core/pluggableElementTypes/GpuHandlerType'
import type PluginManager from '@jbrowse/core/PluginManager'

const UNIFORM_SIZE = 64

interface CanvasState {
  canvas: OffscreenCanvas
  context: GPUCanvasContext
  width: number
  height: number
  logicalWidth: number
  logicalHeight: number
  dpr: number
  instanceBuffer: GPUBuffer | null
  uniformBuffer: GPUBuffer | null
  renderBindGroup: GPUBindGroup | null
  pickingTexture: GPUTexture | null
  pickingStagingBuffer: GPUBuffer | null
  instanceCount: number
  nonCigarInstanceCount: number
  geometryBpPerPx0: number
  geometryBpPerPx1: number
  refOffset0: number
  refOffset1: number
  lastRenderParams: {
    height: number
    adjOff0: number
    adjOff1: number
    scale0: number
    scale1: number
    maxOffScreenPx: number
    minAlignmentLength: number
    alpha: number
    hoveredFeatureId: number
    clickedFeatureId: number
  }
  pickingDirty: boolean
  uniformData: ArrayBuffer
  uniformF32: Float32Array
  uniformU32: Uint32Array
}

export default class SyntenyGpuHandler extends GpuHandlerType {
  name = 'SyntenyGpuHandler'

  private device: GPUDevice | null = null
  private fillPipeline: GPURenderPipeline | null = null
  private fillPickingPipeline: GPURenderPipeline | null = null
  private edgePipeline: GPURenderPipeline | null = null
  private renderBindGroupLayout: GPUBindGroupLayout | null = null
  private canvases = new Map<number, CanvasState>()

  constructor(pm: PluginManager) {
    super(pm)
  }

  init(device: GPUDevice) {
    this.device = device

    this.renderBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    })

    const renderLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.renderBindGroupLayout],
    })

    const blendState: GPUBlendState = {
      color: {
        srcFactor: 'src-alpha',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
      alpha: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
    }

    const fillModule = device.createShaderModule({ code: fillVertexShader })
    this.fillPipeline = device.createRenderPipeline({
      layout: renderLayout,
      vertex: { module: fillModule, entryPoint: 'vs_main' },
      fragment: {
        module: fillModule,
        entryPoint: 'fs_main',
        targets: [{ format: 'bgra8unorm', blend: blendState }],
      },
      primitive: { topology: 'triangle-list' },
    })

    this.fillPickingPipeline = device.createRenderPipeline({
      layout: renderLayout,
      vertex: { module: fillModule, entryPoint: 'vs_main' },
      fragment: {
        module: fillModule,
        entryPoint: 'fs_picking',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'triangle-list' },
    })

    const edgeModule = device.createShaderModule({ code: edgeVertexShader })
    this.edgePipeline = device.createRenderPipeline({
      layout: renderLayout,
      vertex: { module: edgeModule, entryPoint: 'vs_main' },
      fragment: {
        module: edgeModule,
        entryPoint: 'fs_main',
        targets: [{ format: 'bgra8unorm', blend: blendState }],
      },
      primitive: { topology: 'triangle-list' },
    })
  }

  initWebGL() {
    // synteny has no WebGL fallback
  }

  handleMessage(
    msg: { type: string; canvasId: number; [key: string]: unknown },
    ctx: GpuCanvasContext,
  ) {
    if (!this.device) {
      return
    }
    const state = this.ensureCanvas(msg.canvasId, ctx)
    if (!state) {
      return
    }

    switch (msg.type) {
      case 'resize': {
        this.handleResize(state, msg)
        break
      }
      case 'upload-geometry': {
        this.handleUploadGeometry(state, msg)
        break
      }
      case 'render': {
        this.handleRender(state, msg)
        break
      }
      case 'pick': {
        this.handlePick(state, msg)
        break
      }
    }
  }

  dispose(canvasId: number) {
    const state = this.canvases.get(canvasId)
    if (state) {
      state.instanceBuffer?.destroy()
      state.uniformBuffer?.destroy()
      state.pickingTexture?.destroy()
      state.pickingStagingBuffer?.destroy()
      this.canvases.delete(canvasId)
    }
  }

  private ensureCanvas(canvasId: number, ctx: GpuCanvasContext) {
    let state = this.canvases.get(canvasId)
    if (!state && this.device) {
      const gpuContext = ctx.canvas.getContext('webgpu')!
      gpuContext.configure({
        device: this.device,
        format: 'bgra8unorm',
        alphaMode: 'opaque',
      })

      const uniformData = new ArrayBuffer(UNIFORM_SIZE)
      const uniformBuffer = this.device.createBuffer({
        size: UNIFORM_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
      const pickingStagingBuffer = this.device.createBuffer({
        size: 256,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })
      state = {
        canvas: ctx.canvas,
        context: gpuContext,
        width: ctx.canvas.width,
        height: ctx.canvas.height,
        logicalWidth: ctx.width,
        logicalHeight: ctx.height,
        dpr: 2,
        instanceBuffer: null,
        uniformBuffer,
        renderBindGroup: null,
        pickingTexture: null,
        pickingStagingBuffer,
        instanceCount: 0,
        nonCigarInstanceCount: 0,
        geometryBpPerPx0: 1,
        geometryBpPerPx1: 1,
        refOffset0: 0,
        refOffset1: 0,
        lastRenderParams: {
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
        },
        pickingDirty: true,
        uniformData,
        uniformF32: new Float32Array(uniformData),
        uniformU32: new Uint32Array(uniformData),
      }

      this.canvases.set(canvasId, state)
    }
    return state
  }

  private handleResize(state: CanvasState, msg: Record<string, unknown>) {
    state.logicalWidth = msg.width as number
    state.logicalHeight = msg.height as number
    state.dpr = (msg.dpr as number) ?? 2
    state.width = Math.round(state.logicalWidth * state.dpr)
    state.height = Math.round(state.logicalHeight * state.dpr)
    state.canvas.width = state.width
    state.canvas.height = state.height
    this.createPickingTexture(state)
  }

  private createPickingTexture(state: CanvasState) {
    if (!this.device || state.width === 0 || state.height === 0) {
      return
    }
    state.pickingTexture?.destroy()
    state.pickingTexture = this.device.createTexture({
      size: [state.width, state.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    })
  }

  private handleUploadGeometry(state: CanvasState, msg: Record<string, unknown>) {
    if (!this.device) {
      return
    }
    state.instanceCount = msg.instanceCount as number
    state.nonCigarInstanceCount = (msg.nonCigarInstanceCount as number) ?? state.instanceCount
    state.geometryBpPerPx0 = msg.geometryBpPerPx0 as number
    state.geometryBpPerPx1 = msg.geometryBpPerPx1 as number
    state.refOffset0 = (msg.refOffset0 as number) ?? 0
    state.refOffset1 = (msg.refOffset1 as number) ?? 0

    const interleaved = this.interleaveInstances(
      msg.x1 as Float32Array,
      msg.x2 as Float32Array,
      msg.x3 as Float32Array,
      msg.x4 as Float32Array,
      msg.colors as Float32Array,
      msg.featureIds as Float32Array,
      msg.isCurves as Float32Array,
      msg.queryTotalLengths as Float32Array,
      msg.padTops as Float32Array,
      msg.padBottoms as Float32Array,
      state.instanceCount,
    )

    state.instanceBuffer?.destroy()
    state.instanceBuffer = this.device.createBuffer({
      size: interleaved.byteLength || 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(state.instanceBuffer, 0, interleaved)

    this.rebuildBindGroups(state)
    state.pickingDirty = true
  }

  private rebuildBindGroups(state: CanvasState) {
    if (!this.device || !state.instanceBuffer || !state.uniformBuffer) {
      return
    }
    state.renderBindGroup = this.device.createBindGroup({
      layout: this.renderBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: state.instanceBuffer } },
        { binding: 1, resource: { buffer: state.uniformBuffer } },
      ],
    })
  }

  private writeUniforms(state: CanvasState, height: number, adjOff0: number, adjOff1: number, scale0: number, scale1: number, maxOffScreenPx: number, minAlignmentLength: number, alpha: number, hoveredFeatureId: number, clickedFeatureId: number) {
    if (!this.device || !state.uniformBuffer) {
      return
    }
    state.uniformF32[0] = state.logicalWidth
    state.uniformF32[1] = state.logicalHeight
    state.uniformF32[2] = height
    state.uniformF32[3] = adjOff0
    state.uniformF32[4] = adjOff1
    state.uniformF32[5] = scale0
    state.uniformF32[6] = scale1
    state.uniformF32[7] = maxOffScreenPx
    state.uniformF32[8] = minAlignmentLength
    state.uniformF32[9] = alpha
    state.uniformU32[10] = state.instanceCount
    state.uniformU32[11] = FILL_SEGMENTS
    state.uniformU32[12] = EDGE_SEGMENTS
    state.uniformF32[13] = hoveredFeatureId
    state.uniformF32[14] = clickedFeatureId
    state.uniformF32[15] = 0
    this.device.queue.writeBuffer(state.uniformBuffer, 0, state.uniformData)
  }

  private encodeDrawPass(
    state: CanvasState,
    encoder: GPUCommandEncoder,
    view: GPUTextureView,
    pipeline: GPURenderPipeline,
    vertexCount: number,
    loadOp: GPULoadOp,
    clearValue?: GPUColor,
    drawInstanceCount?: number,
  ) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          loadOp,
          storeOp: 'store' as GPUStoreOp,
          ...(clearValue && { clearValue }),
        },
      ],
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, state.renderBindGroup)
    pass.draw(vertexCount, drawInstanceCount ?? state.instanceCount)
    pass.end()
  }

  private handleRender(state: CanvasState, msg: Record<string, unknown>) {
    if (!this.device || !state.instanceBuffer || state.instanceCount === 0) {
      return
    }
    if (!state.renderBindGroup || !this.fillPipeline) {
      return
    }

    const scale0 = state.geometryBpPerPx0 / (msg.curBpPerPx0 as number)
    const scale1 = state.geometryBpPerPx1 / (msg.curBpPerPx1 as number)
    const adjOff0 = (msg.offset0 as number) / scale0 - state.refOffset0
    const adjOff1 = (msg.offset1 as number) / scale1 - state.refOffset1
    const hoveredFeatureId = (msg.hoveredFeatureId as number) ?? 0
    const clickedFeatureId = (msg.clickedFeatureId as number) ?? 0

    this.writeUniforms(
      state,
      msg.height as number,
      adjOff0, adjOff1, scale0, scale1,
      msg.maxOffScreenPx as number,
      msg.minAlignmentLength as number,
      msg.alpha as number,
      hoveredFeatureId, clickedFeatureId,
    )

    state.lastRenderParams = {
      height: msg.height as number,
      adjOff0, adjOff1, scale0, scale1,
      maxOffScreenPx: msg.maxOffScreenPx as number,
      minAlignmentLength: msg.minAlignmentLength as number,
      alpha: msg.alpha as number,
      hoveredFeatureId, clickedFeatureId,
    }
    state.pickingDirty = true

    const encoder = this.device.createCommandEncoder()
    const tv = state.context.getCurrentTexture().createView()
    const white = { r: 1, g: 1, b: 1, a: 1 }

    this.encodeDrawPass(state, encoder, tv, this.fillPipeline, FILL_VERTS_PER_INSTANCE, 'clear', white)
    if (this.edgePipeline && clickedFeatureId > 0) {
      this.encodeDrawPass(state, encoder, tv, this.edgePipeline, EDGE_VERTS_PER_INSTANCE, 'load', undefined, state.nonCigarInstanceCount)
    }
    this.device.queue.submit([encoder.finish()])
  }

  private async handlePick(state: CanvasState, msg: Record<string, unknown>) {
    if (
      !this.device ||
      !state.instanceBuffer ||
      state.instanceCount === 0 ||
      !state.pickingTexture ||
      !state.pickingStagingBuffer
    ) {
      self.postMessage({ type: 'pick-result', canvasId: msg.canvasId, featureIndex: -1 })
      return
    }
    if (!this.fillPickingPipeline || !state.renderBindGroup) {
      self.postMessage({ type: 'pick-result', canvasId: msg.canvasId, featureIndex: -1 })
      return
    }

    if (state.pickingDirty) {
      const p = state.lastRenderParams
      this.writeUniforms(state, p.height, p.adjOff0, p.adjOff1, p.scale0, p.scale1, p.maxOffScreenPx, p.minAlignmentLength, 1, 0, 0)

      const encoder = this.device.createCommandEncoder()
      const pv = state.pickingTexture.createView()
      const transparent = { r: 0, g: 0, b: 0, a: 0 }
      this.encodeDrawPass(state, encoder, pv, this.fillPickingPipeline, FILL_VERTS_PER_INSTANCE, 'clear', transparent)
      this.device.queue.submit([encoder.finish()])
      state.pickingDirty = false
    }

    const px = Math.floor((msg.x as number) * state.dpr)
    const py = Math.floor((msg.y as number) * state.dpr)

    if (px < 0 || px >= state.width || py < 0 || py >= state.height) {
      self.postMessage({ type: 'pick-result', canvasId: msg.canvasId, featureIndex: -1 })
      return
    }

    const encoder = this.device.createCommandEncoder()
    encoder.copyTextureToBuffer(
      { texture: state.pickingTexture, origin: [px, py, 0] },
      { buffer: state.pickingStagingBuffer, bytesPerRow: 256 },
      [1, 1, 1],
    )
    this.device.queue.submit([encoder.finish()])

    await state.pickingStagingBuffer.mapAsync(GPUMapMode.READ)
    const data = new Uint8Array(state.pickingStagingBuffer.getMappedRange())
    const r = data[0]!
    const g = data[1]!
    const b = data[2]!
    state.pickingStagingBuffer.unmap()

    const featureIndex = r === 0 && g === 0 && b === 0 ? -1 : r + g * 256 + b * 65536 - 1
    self.postMessage({ type: 'pick-result', canvasId: msg.canvasId, featureIndex })
  }

  private interleaveInstances(
    x1: Float32Array, x2: Float32Array, x3: Float32Array, x4: Float32Array,
    colors: Float32Array, featureIds: Float32Array, isCurves: Float32Array,
    queryTotalLengths: Float32Array, padTops: Float32Array, padBottoms: Float32Array,
    n: number,
  ) {
    const buf = new ArrayBuffer(n * INSTANCE_BYTE_SIZE)
    const f = new Float32Array(buf)
    const stride = INSTANCE_BYTE_SIZE / 4

    for (let i = 0; i < n; i++) {
      const off = i * stride
      f[off] = x1[i]!
      f[off + 1] = x2[i]!
      f[off + 2] = x3[i]!
      f[off + 3] = x4[i]!
      f[off + 4] = colors[i * 4]!
      f[off + 5] = colors[i * 4 + 1]!
      f[off + 6] = colors[i * 4 + 2]!
      f[off + 7] = colors[i * 4 + 3]!
      f[off + 8] = featureIds[i]!
      f[off + 9] = isCurves[i]!
      f[off + 10] = queryTotalLengths[i]!
      f[off + 11] = padTops[i]!
      f[off + 12] = padBottoms[i]!
      f[off + 13] = 0
      f[off + 14] = 0
      f[off + 15] = 0
    }
    return buf
  }
}
