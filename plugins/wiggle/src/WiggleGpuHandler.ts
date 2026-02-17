/// <reference types="@webgpu/types" />
import GpuHandlerType from '@jbrowse/core/pluggableElementTypes/GpuHandlerType'

import {
  MULTI_INSTANCE_STRIDE,
  multiWiggleShader,
} from './LinearWebGLMultiWiggleDisplay/components/multiWiggleShaders.ts'
import {
  XYPLOT_VERTEX_SHADER,
  DENSITY_VERTEX_SHADER,
  LINE_VERTEX_SHADER,
  WIGGLE_FRAGMENT_SHADER,
} from './LinearWebGLWiggleDisplay/components/WebGLWiggleRenderer.ts'
import {
  MULTI_XYPLOT_VERTEX_SHADER,
  MULTI_DENSITY_VERTEX_SHADER,
  MULTI_LINE_VERTEX_SHADER,
  MULTI_WIGGLE_FRAGMENT_SHADER,
} from './LinearWebGLMultiWiggleDisplay/components/WebGLMultiWiggleRenderer.ts'
import {
  cacheUniforms,
  createProgram,
  splitPositionWithFrac,
} from './shared/webglUtils.ts'
import {
  INSTANCE_STRIDE,
  wiggleShader,
} from './LinearWebGLWiggleDisplay/components/wiggleShaders.ts'

import type { GpuCanvasContext } from '@jbrowse/core/pluggableElementTypes/GpuHandlerType'
import type PluginManager from '@jbrowse/core/PluginManager'

const UNIFORM_SIZE = 96
const MULTI_UNIFORM_SIZE = 48
const INSTANCE_BYTES = INSTANCE_STRIDE * 4
const MULTI_INSTANCE_BYTES = MULTI_INSTANCE_STRIDE * 4

interface GpuRegionData {
  regionStart: number
  featureCount: number
  numRows: number
  instanceBuffer: GPUBuffer
  bindGroup: GPUBindGroup
}

interface GpuCanvasState {
  canvas: OffscreenCanvas
  context: GPUCanvasContext
  width: number
  height: number
  regions: Map<number, GpuRegionData>
}

interface WebGLRegionBuffers {
  regionStart: number
  featureCount: number
  numRows: number
  featureVAO: WebGLVertexArrayObject
  lineVAO: WebGLVertexArrayObject | null
  glBuffers: WebGLBuffer[]
}

interface WebGLCanvasState {
  canvas: OffscreenCanvas
  gl: WebGL2RenderingContext
  width: number
  height: number
  regions: Map<number, WebGLRegionBuffers>
  programs: {
    xyplot: WebGLProgram
    density: WebGLProgram
    line: WebGLProgram
    multiXyplot: WebGLProgram
    multiDensity: WebGLProgram
    multiLine: WebGLProgram
  }
  uniforms: {
    xyplot: Record<string, WebGLUniformLocation | null>
    density: Record<string, WebGLUniformLocation | null>
    line: Record<string, WebGLUniformLocation | null>
    multiXyplot: Record<string, WebGLUniformLocation | null>
    multiDensity: Record<string, WebGLUniformLocation | null>
    multiLine: Record<string, WebGLUniformLocation | null>
  }
}

const SINGLE_UNIFORM_NAMES = [
  'u_bpRangeX',
  'u_regionStart',
  'u_canvasHeight',
  'u_domainY',
  'u_scaleType',
  'u_color',
  'u_posColor',
  'u_negColor',
  'u_bicolorPivot',
  'u_useBicolor',
]

const MULTI_UNIFORM_NAMES = [
  'u_bpRangeX',
  'u_regionStart',
  'u_canvasHeight',
  'u_domainY',
  'u_scaleType',
  'u_numRows',
  'u_rowPadding',
]

export default class WiggleGpuHandler extends GpuHandlerType {
  name = 'WiggleGpuHandler'

  private device: GPUDevice | null = null
  private fillPipeline: GPURenderPipeline | null = null
  private linePipeline: GPURenderPipeline | null = null
  private bindGroupLayout: GPUBindGroupLayout | null = null
  private uniformBuffer: GPUBuffer | null = null
  private multiFillPipeline: GPURenderPipeline | null = null
  private multiLinePipeline: GPURenderPipeline | null = null
  private multiBindGroupLayout: GPUBindGroupLayout | null = null
  private multiUniformBuffer: GPUBuffer | null = null

  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformI32 = new Int32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private multiUniformData = new ArrayBuffer(MULTI_UNIFORM_SIZE)
  private multiUniformF32 = new Float32Array(this.multiUniformData)
  private multiUniformI32 = new Int32Array(this.multiUniformData)
  private multiUniformU32 = new Uint32Array(this.multiUniformData)

  private gpuCanvases = new Map<number, GpuCanvasState>()
  private glCanvases = new Map<number, WebGLCanvasState>()
  private useWebGL = false

  constructor(pm: PluginManager) {
    super(pm)
  }

  init(device: GPUDevice) {
    this.device = device
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
    const target: GPUColorTargetState = {
      format: 'bgra8unorm',
      blend: blendState,
    }

    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
      ],
    })

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    })
    const shaderModule = device.createShaderModule({ code: wiggleShader })

    this.fillPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'triangle-list' },
    })
    this.linePipeline = device.createRenderPipeline({
      layout,
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'line-list' },
    })

    this.multiUniformBuffer = device.createBuffer({
      size: MULTI_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.multiBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
      ],
    })

    const multiLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.multiBindGroupLayout],
    })
    const multiShaderModule = device.createShaderModule({
      code: multiWiggleShader,
    })

    this.multiFillPipeline = device.createRenderPipeline({
      layout: multiLayout,
      vertex: { module: multiShaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: multiShaderModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'triangle-list' },
    })
    this.multiLinePipeline = device.createRenderPipeline({
      layout: multiLayout,
      vertex: { module: multiShaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: multiShaderModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'line-list' },
    })
  }

  initWebGL() {
    this.useWebGL = true
  }

  handleMessage(
    msg: { type: string; canvasId: number; [key: string]: unknown },
    ctx: GpuCanvasContext,
  ) {
    if (this.useWebGL) {
      this.handleWebGLMessage(msg, ctx)
    } else {
      this.handleWebGPUMessage(msg, ctx)
    }
  }

  dispose(canvasId: number) {
    const gpuState = this.gpuCanvases.get(canvasId)
    if (gpuState) {
      for (const region of gpuState.regions.values()) {
        region.instanceBuffer.destroy()
      }
      this.gpuCanvases.delete(canvasId)
    }
    const glState = this.glCanvases.get(canvasId)
    if (glState) {
      for (const region of glState.regions.values()) {
        this.deleteGLRegion(glState.gl, region)
      }
      const { gl, programs } = glState
      gl.deleteProgram(programs.xyplot)
      gl.deleteProgram(programs.density)
      gl.deleteProgram(programs.line)
      gl.deleteProgram(programs.multiXyplot)
      gl.deleteProgram(programs.multiDensity)
      gl.deleteProgram(programs.multiLine)
      this.glCanvases.delete(canvasId)
    }
  }

  // ─── WebGPU path ──────────────────────────────────────

  private ensureGpuCanvas(canvasId: number, ctx: GpuCanvasContext) {
    let state = this.gpuCanvases.get(canvasId)
    if (!state) {
      const gpuContext = ctx.canvas.getContext('webgpu')!
      gpuContext.configure({
        device: this.device!,
        format: 'bgra8unorm',
        alphaMode: 'premultiplied',
      })
      state = {
        canvas: ctx.canvas,
        context: gpuContext,
        width: ctx.width,
        height: ctx.height,
        regions: new Map(),
      }
      this.gpuCanvases.set(canvasId, state)
    }
    return state
  }

  private handleWebGPUMessage(
    msg: { type: string; canvasId: number; [key: string]: unknown },
    ctx: GpuCanvasContext,
  ) {
    const state = this.ensureGpuCanvas(msg.canvasId, ctx)
    switch (msg.type) {
      case 'resize': {
        state.width = msg.width as number
        state.height = msg.height as number
        state.canvas.width = msg.width as number
        state.canvas.height = msg.height as number
        break
      }
      case 'upload-region': {
        this.gpuUploadRegion(state, msg)
        break
      }
      case 'upload-multi-region': {
        this.gpuUploadMultiRegion(state, msg)
        break
      }
      case 'prune-regions': {
        this.gpuPruneRegions(state, msg)
        break
      }
      case 'render': {
        this.gpuRender(state, msg)
        break
      }
      case 'render-single': {
        this.gpuRenderSingle(state, msg)
        break
      }
      case 'render-multi': {
        this.gpuRenderMulti(state, msg)
        break
      }
      case 'render-multi-single': {
        this.gpuRenderMultiSingle(state, msg)
        break
      }
    }
  }

  private gpuUploadRegion(
    state: GpuCanvasState,
    msg: Record<string, unknown>,
  ) {
    if (!this.device || !this.bindGroupLayout || !this.uniformBuffer) {
      return
    }
    const regionNumber = msg.regionNumber as number
    const old = state.regions.get(regionNumber)
    if (old) {
      old.instanceBuffer.destroy()
    }
    const numFeatures = msg.numFeatures as number
    if (numFeatures === 0) {
      state.regions.delete(regionNumber)
      return
    }
    const interleaved = this.interleaveInstances(
      msg.featurePositions as Uint32Array,
      msg.featureScores as Float32Array,
      numFeatures,
    )
    const instanceBuffer = this.device.createBuffer({
      size: interleaved.byteLength || 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(instanceBuffer, 0, interleaved)
    const bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    })
    state.regions.set(regionNumber, {
      regionStart: msg.regionStart as number,
      featureCount: numFeatures,
      numRows: 1,
      instanceBuffer,
      bindGroup,
    })
  }

  private gpuUploadMultiRegion(
    state: GpuCanvasState,
    msg: Record<string, unknown>,
  ) {
    if (!this.device || !this.multiBindGroupLayout || !this.multiUniformBuffer) {
      return
    }
    const regionNumber = msg.regionNumber as number
    const old = state.regions.get(regionNumber)
    if (old) {
      old.instanceBuffer.destroy()
    }
    const totalFeatures = msg.totalFeatures as number
    if (totalFeatures === 0) {
      state.regions.delete(regionNumber)
      return
    }
    const interleaved = this.interleaveMultiInstances(
      msg.positions as Uint32Array,
      msg.scores as Float32Array,
      msg.prevScores as Float32Array,
      msg.rowIndices as Float32Array,
      msg.colors as Float32Array,
      totalFeatures,
    )
    const instanceBuffer = this.device.createBuffer({
      size: interleaved.byteLength || 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(instanceBuffer, 0, interleaved)
    const bindGroup = this.device.createBindGroup({
      layout: this.multiBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: this.multiUniformBuffer } },
      ],
    })
    state.regions.set(regionNumber, {
      regionStart: msg.regionStart as number,
      featureCount: totalFeatures,
      numRows: msg.numRows as number,
      instanceBuffer,
      bindGroup,
    })
  }

  private gpuPruneRegions(
    state: GpuCanvasState,
    msg: Record<string, unknown>,
  ) {
    const active = new Set<number>(msg.activeRegions as number[])
    for (const [num, region] of state.regions) {
      if (!active.has(num)) {
        region.instanceBuffer.destroy()
        state.regions.delete(num)
      }
    }
  }

  private gpuRender(state: GpuCanvasState, msg: Record<string, unknown>) {
    if (!this.device || !this.fillPipeline || !this.linePipeline || !this.uniformBuffer) {
      return
    }
    const { blocks, renderState } = msg as {
      blocks: {
        regionNumber: number
        bpRangeX: [number, number]
        screenStartPx: number
        screenEndPx: number
      }[]
      renderState: Record<string, unknown>
    }
    const canvasWidth = renderState.canvasWidth as number
    const canvasHeight = renderState.canvasHeight as number
    const isLine = renderState.renderingType === 2
    const pipeline = isLine ? this.linePipeline : this.fillPipeline

    this.gpuRenderBlocks(state, blocks, canvasWidth, canvasHeight, pipeline, (hi, lo, len, region) => {
      this.writeUniforms(
        hi, lo, len,
        Math.floor(region.regionStart),
        canvasHeight,
        renderState.scaleType as number,
        renderState.renderingType as number,
        renderState.useBicolor as number,
        renderState.domainY as [number, number],
        renderState.bicolorPivot as number,
        renderState.color as [number, number, number],
        renderState.posColor as [number, number, number],
        renderState.negColor as [number, number, number],
      )
    })
  }

  private gpuRenderSingle(state: GpuCanvasState, msg: Record<string, unknown>) {
    if (!this.device || !this.fillPipeline || !this.linePipeline || !this.uniformBuffer) {
      return
    }
    const renderState = msg.renderState as Record<string, unknown>
    const bpRangeX = msg.bpRangeX as [number, number]
    const canvasWidth = renderState.canvasWidth as number
    const canvasHeight = renderState.canvasHeight as number
    const isLine = renderState.renderingType === 2
    const pipeline = isLine ? this.linePipeline : this.fillPipeline

    if (state.canvas.width !== canvasWidth || state.canvas.height !== canvasHeight) {
      state.canvas.width = canvasWidth
      state.canvas.height = canvasHeight
    }

    const region = state.regions.get(0) ?? state.regions.values().next().value
    if (!region || region.featureCount === 0) {
      this.clearGpuCanvas(state)
      return
    }

    const [bpStartHi, bpStartLo] = this.splitPositionWithFrac(bpRangeX[0])
    const regionLengthBp = bpRangeX[1] - bpRangeX[0]

    this.writeUniforms(
      bpStartHi, bpStartLo, regionLengthBp,
      Math.floor(region.regionStart),
      canvasHeight,
      renderState.scaleType as number,
      renderState.renderingType as number,
      renderState.useBicolor as number,
      renderState.domainY as [number, number],
      renderState.bicolorPivot as number,
      renderState.color as [number, number, number],
      renderState.posColor as [number, number, number],
      renderState.negColor as [number, number, number],
    )

    const encoder = this.device.createCommandEncoder()
    const textureView = state.context.getCurrentTexture().createView()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'clear' as GPULoadOp,
          storeOp: 'store' as GPUStoreOp,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, region.bindGroup)
    pass.setViewport(0, 0, canvasWidth, canvasHeight, 0, 1)
    pass.draw(6, region.featureCount)
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  private gpuRenderMulti(state: GpuCanvasState, msg: Record<string, unknown>) {
    if (!this.device || !this.multiFillPipeline || !this.multiLinePipeline || !this.multiUniformBuffer) {
      return
    }
    const { blocks, renderState } = msg as {
      blocks: {
        regionNumber: number
        bpRangeX: [number, number]
        screenStartPx: number
        screenEndPx: number
      }[]
      renderState: Record<string, unknown>
    }
    const canvasWidth = renderState.canvasWidth as number
    const canvasHeight = renderState.canvasHeight as number
    const isLine = renderState.renderingType === 2
    const pipeline = isLine ? this.multiLinePipeline : this.multiFillPipeline

    this.gpuRenderBlocks(state, blocks, canvasWidth, canvasHeight, pipeline, (hi, lo, len, region) => {
      this.writeMultiUniforms(
        hi, lo, len,
        Math.floor(region.regionStart),
        canvasHeight,
        renderState.scaleType as number,
        renderState.renderingType as number,
        region.numRows,
        renderState.domainY as [number, number],
        renderState.rowPadding as number,
      )
    })
  }

  private gpuRenderMultiSingle(state: GpuCanvasState, msg: Record<string, unknown>) {
    if (!this.device || !this.multiFillPipeline || !this.multiLinePipeline || !this.multiUniformBuffer) {
      return
    }
    const renderState = msg.renderState as Record<string, unknown>
    const bpRangeX = msg.bpRangeX as [number, number]
    const canvasWidth = renderState.canvasWidth as number
    const canvasHeight = renderState.canvasHeight as number
    const isLine = renderState.renderingType === 2
    const pipeline = isLine ? this.multiLinePipeline : this.multiFillPipeline

    if (state.canvas.width !== canvasWidth || state.canvas.height !== canvasHeight) {
      state.canvas.width = canvasWidth
      state.canvas.height = canvasHeight
    }

    const region = state.regions.get(0) ?? state.regions.values().next().value
    if (!region || region.featureCount === 0) {
      this.clearGpuCanvas(state)
      return
    }

    const [bpStartHi, bpStartLo] = this.splitPositionWithFrac(bpRangeX[0])
    const regionLengthBp = bpRangeX[1] - bpRangeX[0]

    this.writeMultiUniforms(
      bpStartHi, bpStartLo, regionLengthBp,
      Math.floor(region.regionStart),
      canvasHeight,
      renderState.scaleType as number,
      renderState.renderingType as number,
      region.numRows,
      renderState.domainY as [number, number],
      renderState.rowPadding as number,
    )

    const encoder = this.device!.createCommandEncoder()
    const textureView = state.context.getCurrentTexture().createView()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'clear' as GPULoadOp,
          storeOp: 'store' as GPUStoreOp,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, region.bindGroup)
    pass.setViewport(0, 0, canvasWidth, canvasHeight, 0, 1)
    pass.draw(6, region.featureCount)
    pass.end()
    this.device!.queue.submit([encoder.finish()])
  }

  private gpuRenderBlocks(
    state: GpuCanvasState,
    blocks: {
      regionNumber: number
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    }[],
    canvasWidth: number,
    canvasHeight: number,
    pipeline: GPURenderPipeline,
    writeUniformsFn: (
      bpRangeHi: number,
      bpRangeLo: number,
      bpRangeLength: number,
      region: GpuRegionData,
    ) => void,
  ) {
    if (state.canvas.width !== canvasWidth || state.canvas.height !== canvasHeight) {
      state.canvas.width = canvasWidth
      state.canvas.height = canvasHeight
      state.width = canvasWidth
      state.height = canvasHeight
    }

    let isFirst = true
    for (const block of blocks) {
      const region = state.regions.get(block.regionNumber)
      if (!region || region.featureCount === 0) {
        continue
      }

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const regionLengthBp = block.bpRangeX[1] - block.bpRangeX[0]
      const bpPerPx = regionLengthBp / fullBlockWidth
      const clippedBpStart = block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedBpEnd = block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx
      const [bpStartHi, bpStartLo] = this.splitPositionWithFrac(clippedBpStart)
      const clippedLengthBp = clippedBpEnd - clippedBpStart

      writeUniformsFn(bpStartHi, bpStartLo, clippedLengthBp, region)

      const encoder = this.device!.createCommandEncoder()
      const textureView = state.context.getCurrentTexture().createView()
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            loadOp: (isFirst ? 'clear' : 'load') as GPULoadOp,
            storeOp: 'store' as GPUStoreOp,
            ...(isFirst && { clearValue: { r: 0, g: 0, b: 0, a: 0 } }),
          },
        ],
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, region.bindGroup)
      pass.setViewport(scissorX, 0, scissorW, canvasHeight, 0, 1)
      pass.setScissorRect(scissorX, 0, scissorW, canvasHeight)
      pass.draw(6, region.featureCount)
      pass.end()
      this.device!.queue.submit([encoder.finish()])
      isFirst = false
    }

    if (isFirst) {
      this.clearGpuCanvas(state)
    }
  }

  private clearGpuCanvas(state: GpuCanvasState) {
    const encoder = this.device!.createCommandEncoder()
    const textureView = state.context.getCurrentTexture().createView()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'clear' as GPULoadOp,
          storeOp: 'store' as GPUStoreOp,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    })
    pass.end()
    this.device!.queue.submit([encoder.finish()])
  }

  private writeUniforms(
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLength: number,
    regionStart: number,
    canvasHeight: number,
    scaleType: number,
    renderingType: number,
    useBicolor: number,
    domainY: [number, number],
    bicolorPivot: number,
    color: [number, number, number],
    posColor: [number, number, number],
    negColor: [number, number, number],
  ) {
    this.uniformF32[0] = bpRangeHi
    this.uniformF32[1] = bpRangeLo
    this.uniformF32[2] = bpRangeLength
    this.uniformU32[3] = regionStart
    this.uniformF32[4] = canvasHeight
    this.uniformI32[5] = scaleType
    this.uniformI32[6] = renderingType
    this.uniformI32[7] = useBicolor
    this.uniformF32[8] = domainY[0]
    this.uniformF32[9] = domainY[1]
    this.uniformF32[10] = bicolorPivot
    this.uniformF32[11] = 0
    this.uniformF32[12] = color[0]
    this.uniformF32[13] = color[1]
    this.uniformF32[14] = color[2]
    this.uniformF32[15] = 0
    this.uniformF32[16] = posColor[0]
    this.uniformF32[17] = posColor[1]
    this.uniformF32[18] = posColor[2]
    this.uniformF32[19] = 0
    this.uniformF32[20] = negColor[0]
    this.uniformF32[21] = negColor[1]
    this.uniformF32[22] = negColor[2]
    this.uniformF32[23] = 0
    this.device!.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData)
  }

  private writeMultiUniforms(
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLength: number,
    regionStart: number,
    canvasHeight: number,
    scaleType: number,
    renderingType: number,
    numRows: number,
    domainY: [number, number],
    rowPadding: number,
  ) {
    this.multiUniformF32[0] = bpRangeHi
    this.multiUniformF32[1] = bpRangeLo
    this.multiUniformF32[2] = bpRangeLength
    this.multiUniformU32[3] = regionStart
    this.multiUniformF32[4] = canvasHeight
    this.multiUniformI32[5] = scaleType
    this.multiUniformI32[6] = renderingType
    this.multiUniformF32[7] = numRows
    this.multiUniformF32[8] = domainY[0]
    this.multiUniformF32[9] = domainY[1]
    this.multiUniformF32[10] = rowPadding
    this.multiUniformF32[11] = 0
    this.device!.queue.writeBuffer(this.multiUniformBuffer!, 0, this.multiUniformData)
  }

  private splitPositionWithFrac(value: number): [number, number] {
    const intValue = Math.floor(value)
    const frac = value - intValue
    const loInt = intValue & 0xfff
    const hi = intValue - loInt
    const lo = loInt + frac
    return [hi, lo]
  }

  private interleaveInstances(positions: Uint32Array, scores: Float32Array, count: number) {
    const buf = new ArrayBuffer(count * INSTANCE_BYTES)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < count; i++) {
      const off = i * INSTANCE_STRIDE
      u32[off] = positions[i * 2]!
      u32[off + 1] = positions[i * 2 + 1]!
      f32[off + 2] = scores[i]!
      f32[off + 3] = 0
    }
    return buf
  }

  private interleaveMultiInstances(
    positions: Uint32Array,
    scores: Float32Array,
    prevScores: Float32Array,
    rowIndices: Float32Array,
    colors: Float32Array,
    count: number,
  ) {
    const buf = new ArrayBuffer(count * MULTI_INSTANCE_BYTES)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < count; i++) {
      const off = i * MULTI_INSTANCE_STRIDE
      u32[off] = positions[i * 2]!
      u32[off + 1] = positions[i * 2 + 1]!
      f32[off + 2] = scores[i]!
      f32[off + 3] = prevScores[i]!
      f32[off + 4] = rowIndices[i]!
      f32[off + 5] = colors[i * 3]!
      f32[off + 6] = colors[i * 3 + 1]!
      f32[off + 7] = colors[i * 3 + 2]!
    }
    return buf
  }

  // ─── WebGL fallback path ──────────────────────────────

  private initGLCanvas(canvas: OffscreenCanvas) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })!

    const programs = {
      xyplot: createProgram(gl, XYPLOT_VERTEX_SHADER, WIGGLE_FRAGMENT_SHADER),
      density: createProgram(gl, DENSITY_VERTEX_SHADER, WIGGLE_FRAGMENT_SHADER),
      line: createProgram(gl, LINE_VERTEX_SHADER, WIGGLE_FRAGMENT_SHADER),
      multiXyplot: createProgram(gl, MULTI_XYPLOT_VERTEX_SHADER, MULTI_WIGGLE_FRAGMENT_SHADER),
      multiDensity: createProgram(gl, MULTI_DENSITY_VERTEX_SHADER, MULTI_WIGGLE_FRAGMENT_SHADER),
      multiLine: createProgram(gl, MULTI_LINE_VERTEX_SHADER, MULTI_WIGGLE_FRAGMENT_SHADER),
    }

    const uniforms = {
      xyplot: cacheUniforms(gl, programs.xyplot, SINGLE_UNIFORM_NAMES),
      density: cacheUniforms(gl, programs.density, SINGLE_UNIFORM_NAMES),
      line: cacheUniforms(gl, programs.line, SINGLE_UNIFORM_NAMES),
      multiXyplot: cacheUniforms(gl, programs.multiXyplot, MULTI_UNIFORM_NAMES),
      multiDensity: cacheUniforms(gl, programs.multiDensity, MULTI_UNIFORM_NAMES),
      multiLine: cacheUniforms(gl, programs.multiLine, MULTI_UNIFORM_NAMES),
    }

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    return { gl, programs, uniforms }
  }

  private ensureGLCanvas(canvasId: number, ctx: GpuCanvasContext) {
    let state = this.glCanvases.get(canvasId)
    if (!state) {
      const { gl, programs, uniforms } = this.initGLCanvas(ctx.canvas)
      state = {
        canvas: ctx.canvas,
        gl,
        width: ctx.width,
        height: ctx.height,
        regions: new Map(),
        programs,
        uniforms,
      }
      this.glCanvases.set(canvasId, state)
    }
    return state
  }

  private handleWebGLMessage(
    msg: { type: string; canvasId: number; [key: string]: unknown },
    ctx: GpuCanvasContext,
  ) {
    const state = this.ensureGLCanvas(msg.canvasId, ctx)
    switch (msg.type) {
      case 'resize': {
        state.width = msg.width as number
        state.height = msg.height as number
        state.canvas.width = msg.width as number
        state.canvas.height = msg.height as number
        break
      }
      case 'upload-region': {
        this.glUploadRegion(state, msg)
        break
      }
      case 'upload-multi-region': {
        this.glUploadMultiRegion(state, msg)
        break
      }
      case 'prune-regions': {
        this.glPruneRegions(state, msg)
        break
      }
      case 'render': {
        this.glRender(state, msg)
        break
      }
      case 'render-single': {
        this.glRenderSingle(state, msg)
        break
      }
      case 'render-multi': {
        this.glRenderMulti(state, msg)
        break
      }
      case 'render-multi-single': {
        this.glRenderMultiSingle(state, msg)
        break
      }
    }
  }

  private uploadFloat(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    attrib: string,
    data: Float32Array,
    size: number,
  ) {
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return []
    }
    const buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
    return [buffer]
  }

  private uploadUint(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    attrib: string,
    data: Uint32Array,
    size: number,
  ) {
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return []
    }
    const buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_INT, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
    return [buffer]
  }

  private deleteGLRegion(gl: WebGL2RenderingContext, region: WebGLRegionBuffers) {
    for (const buf of region.glBuffers) {
      gl.deleteBuffer(buf)
    }
    gl.deleteVertexArray(region.featureVAO)
    if (region.lineVAO) {
      gl.deleteVertexArray(region.lineVAO)
    }
  }

  private glUploadRegion(state: WebGLCanvasState, msg: Record<string, unknown>) {
    const { gl, programs } = state
    const regionNumber = msg.regionNumber as number
    const old = state.regions.get(regionNumber)
    if (old) {
      this.deleteGLRegion(gl, old)
    }
    const numFeatures = msg.numFeatures as number
    if (numFeatures === 0) {
      state.regions.delete(regionNumber)
      return
    }
    const positions = msg.featurePositions as Uint32Array
    const scores = msg.featureScores as Float32Array
    const glBuffers: WebGLBuffer[] = []

    const featureVAO = gl.createVertexArray()!
    gl.bindVertexArray(featureVAO)
    glBuffers.push(
      ...this.uploadUint(gl, programs.xyplot, 'a_position', positions, 2),
      ...this.uploadFloat(gl, programs.xyplot, 'a_score', scores, 1),
    )
    gl.bindVertexArray(null)

    const lineVAO = gl.createVertexArray()!
    gl.bindVertexArray(lineVAO)
    glBuffers.push(
      ...this.uploadUint(gl, programs.line, 'a_position', positions, 2),
      ...this.uploadFloat(gl, programs.line, 'a_score', scores, 1),
    )
    const prevScores = new Float32Array(numFeatures)
    prevScores[0] = scores[0]!
    for (let i = 1; i < numFeatures; i++) {
      prevScores[i] = scores[i - 1]!
    }
    glBuffers.push(...this.uploadFloat(gl, programs.line, 'a_prevScore', prevScores, 1))
    gl.bindVertexArray(null)

    state.regions.set(regionNumber, {
      regionStart: msg.regionStart as number,
      featureCount: numFeatures,
      numRows: 1,
      featureVAO,
      lineVAO,
      glBuffers,
    })
  }

  private glUploadMultiRegion(state: WebGLCanvasState, msg: Record<string, unknown>) {
    const { gl, programs } = state
    const regionNumber = msg.regionNumber as number
    const old = state.regions.get(regionNumber)
    if (old) {
      this.deleteGLRegion(gl, old)
    }
    const totalFeatures = msg.totalFeatures as number
    if (totalFeatures === 0) {
      state.regions.delete(regionNumber)
      return
    }
    const positions = msg.positions as Uint32Array
    const scores = msg.scores as Float32Array
    const prevScores = msg.prevScores as Float32Array
    const rowIndices = msg.rowIndices as Float32Array
    const colors = msg.colors as Float32Array
    const glBuffers: WebGLBuffer[] = []

    const featureVAO = gl.createVertexArray()!
    gl.bindVertexArray(featureVAO)
    glBuffers.push(
      ...this.uploadUint(gl, programs.multiXyplot, 'a_position', positions, 2),
      ...this.uploadFloat(gl, programs.multiXyplot, 'a_score', scores, 1),
      ...this.uploadFloat(gl, programs.multiXyplot, 'a_rowIndex', rowIndices, 1),
      ...this.uploadFloat(gl, programs.multiXyplot, 'a_color', colors, 3),
    )
    gl.bindVertexArray(null)

    const lineVAO = gl.createVertexArray()!
    gl.bindVertexArray(lineVAO)
    glBuffers.push(
      ...this.uploadUint(gl, programs.multiLine, 'a_position', positions, 2),
      ...this.uploadFloat(gl, programs.multiLine, 'a_score', scores, 1),
      ...this.uploadFloat(gl, programs.multiLine, 'a_prevScore', prevScores, 1),
      ...this.uploadFloat(gl, programs.multiLine, 'a_rowIndex', rowIndices, 1),
      ...this.uploadFloat(gl, programs.multiLine, 'a_color', colors, 3),
    )
    gl.bindVertexArray(null)

    state.regions.set(regionNumber, {
      regionStart: msg.regionStart as number,
      featureCount: totalFeatures,
      numRows: msg.numRows as number,
      featureVAO,
      lineVAO,
      glBuffers,
    })
  }

  private glPruneRegions(state: WebGLCanvasState, msg: Record<string, unknown>) {
    const active = new Set<number>(msg.activeRegions as number[])
    for (const [num, region] of state.regions) {
      if (!active.has(num)) {
        this.deleteGLRegion(state.gl, region)
        state.regions.delete(num)
      }
    }
  }

  private setSingleUniforms(
    gl: WebGL2RenderingContext,
    uniforms: Record<string, WebGLUniformLocation | null>,
    renderState: Record<string, unknown>,
  ) {
    gl.uniform1f(uniforms.u_canvasHeight!, renderState.canvasHeight as number)
    const domainY = renderState.domainY as [number, number]
    gl.uniform2f(uniforms.u_domainY!, domainY[0], domainY[1])
    gl.uniform1i(uniforms.u_scaleType!, renderState.scaleType as number)
    const color = renderState.color as [number, number, number]
    gl.uniform3f(uniforms.u_color!, color[0], color[1], color[2])
    const posColor = renderState.posColor as [number, number, number]
    gl.uniform3f(uniforms.u_posColor!, posColor[0], posColor[1], posColor[2])
    const negColor = renderState.negColor as [number, number, number]
    gl.uniform3f(uniforms.u_negColor!, negColor[0], negColor[1], negColor[2])
    gl.uniform1f(uniforms.u_bicolorPivot!, renderState.bicolorPivot as number)
    gl.uniform1i(uniforms.u_useBicolor!, renderState.useBicolor as number)
  }

  private setMultiUniforms(
    gl: WebGL2RenderingContext,
    uniforms: Record<string, WebGLUniformLocation | null>,
    renderState: Record<string, unknown>,
  ) {
    gl.uniform1f(uniforms.u_canvasHeight!, renderState.canvasHeight as number)
    const domainY = renderState.domainY as [number, number]
    gl.uniform2f(uniforms.u_domainY!, domainY[0], domainY[1])
    gl.uniform1i(uniforms.u_scaleType!, renderState.scaleType as number)
    gl.uniform1f(uniforms.u_rowPadding!, renderState.rowPadding as number)
  }

  private glRenderBlocks(
    state: WebGLCanvasState,
    blocks: {
      regionNumber: number
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    }[],
    canvasWidth: number,
    canvasHeight: number,
    isLine: boolean,
    program: WebGLProgram,
    uniforms: Record<string, WebGLUniformLocation | null>,
    setPerBlockUniforms: (
      gl: WebGL2RenderingContext,
      uniforms: Record<string, WebGLUniformLocation | null>,
      region: WebGLRegionBuffers,
      bpStartHi: number,
      bpStartLo: number,
      bpLength: number,
    ) => void,
  ) {
    const { gl, canvas } = state
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (blocks.length === 0) {
      return
    }
    gl.useProgram(program)
    gl.enable(gl.SCISSOR_TEST)

    for (const block of blocks) {
      const region = state.regions.get(block.regionNumber)
      if (!region || region.featureCount === 0) {
        continue
      }
      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }
      gl.scissor(scissorX, 0, scissorW, canvasHeight)
      gl.viewport(scissorX, 0, scissorW, canvasHeight)

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const regionLengthBp = block.bpRangeX[1] - block.bpRangeX[0]
      const bpPerPx = regionLengthBp / fullBlockWidth
      const clippedBpStart = block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedBpEnd = block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx
      const [bpStartHi, bpStartLo] = splitPositionWithFrac(clippedBpStart)
      const clippedLengthBp = clippedBpEnd - clippedBpStart

      setPerBlockUniforms(gl, uniforms, region, bpStartHi, bpStartLo, clippedLengthBp)

      const vao = isLine ? (region.lineVAO ?? region.featureVAO) : region.featureVAO
      gl.bindVertexArray(vao)
      if (isLine) {
        gl.drawArraysInstanced(gl.LINES, 0, 6, region.featureCount)
      } else {
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, region.featureCount)
      }
      gl.bindVertexArray(null)
    }
    gl.disable(gl.SCISSOR_TEST)
    gl.viewport(0, 0, canvasWidth, canvasHeight)
  }

  private glRender(state: WebGLCanvasState, msg: Record<string, unknown>) {
    const renderState = msg.renderState as Record<string, unknown>
    const blocks = msg.blocks as {
      regionNumber: number
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    }[]
    const canvasWidth = renderState.canvasWidth as number
    const canvasHeight = renderState.canvasHeight as number
    const isLine = renderState.renderingType === 2
    const isDensity = renderState.renderingType === 1

    let program: WebGLProgram
    let uniforms: Record<string, WebGLUniformLocation | null>
    if (isLine) {
      program = state.programs.line
      uniforms = state.uniforms.line
    } else if (isDensity) {
      program = state.programs.density
      uniforms = state.uniforms.density
    } else {
      program = state.programs.xyplot
      uniforms = state.uniforms.xyplot
    }

    state.gl.useProgram(program)
    this.setSingleUniforms(state.gl, uniforms, renderState)
    this.glRenderBlocks(
      state, blocks, canvasWidth, canvasHeight, isLine, program, uniforms,
      (gl, u, region, hi, lo, len) => {
        gl.uniform3f(u.u_bpRangeX!, hi, lo, len)
        gl.uniform1ui(u.u_regionStart!, Math.floor(region.regionStart))
      },
    )
  }

  private glRenderSingle(state: WebGLCanvasState, msg: Record<string, unknown>) {
    const renderState = msg.renderState as Record<string, unknown>
    const bpRangeX = msg.bpRangeX as [number, number]
    const canvasWidth = renderState.canvasWidth as number
    const canvasHeight = renderState.canvasHeight as number
    const { gl, canvas } = state

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const region = state.regions.get(0) ?? state.regions.values().next().value
    if (!region || region.featureCount === 0) {
      return
    }

    const isLine = renderState.renderingType === 2
    const isDensity = renderState.renderingType === 1

    let program: WebGLProgram
    let uniforms: Record<string, WebGLUniformLocation | null>
    if (isLine) {
      program = state.programs.line
      uniforms = state.uniforms.line
    } else if (isDensity) {
      program = state.programs.density
      uniforms = state.uniforms.density
    } else {
      program = state.programs.xyplot
      uniforms = state.uniforms.xyplot
    }

    gl.useProgram(program)
    this.setSingleUniforms(gl, uniforms, renderState)
    const [bpStartHi, bpStartLo] = splitPositionWithFrac(bpRangeX[0])
    const regionLengthBp = bpRangeX[1] - bpRangeX[0]
    gl.uniform3f(uniforms.u_bpRangeX!, bpStartHi, bpStartLo, regionLengthBp)
    gl.uniform1ui(uniforms.u_regionStart!, Math.floor(region.regionStart))

    const vao = isLine ? (region.lineVAO ?? region.featureVAO) : region.featureVAO
    gl.bindVertexArray(vao)
    if (isLine) {
      gl.drawArraysInstanced(gl.LINES, 0, 6, region.featureCount)
    } else {
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, region.featureCount)
    }
    gl.bindVertexArray(null)
  }

  private glRenderMulti(state: WebGLCanvasState, msg: Record<string, unknown>) {
    const renderState = msg.renderState as Record<string, unknown>
    const blocks = msg.blocks as {
      regionNumber: number
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    }[]
    const canvasWidth = renderState.canvasWidth as number
    const canvasHeight = renderState.canvasHeight as number
    const isLine = renderState.renderingType === 2
    const isDensity = renderState.renderingType === 1

    let program: WebGLProgram
    let uniforms: Record<string, WebGLUniformLocation | null>
    if (isLine) {
      program = state.programs.multiLine
      uniforms = state.uniforms.multiLine
    } else if (isDensity) {
      program = state.programs.multiDensity
      uniforms = state.uniforms.multiDensity
    } else {
      program = state.programs.multiXyplot
      uniforms = state.uniforms.multiXyplot
    }

    state.gl.useProgram(program)
    this.setMultiUniforms(state.gl, uniforms, renderState)
    this.glRenderBlocks(
      state, blocks, canvasWidth, canvasHeight, isLine, program, uniforms,
      (gl, u, region, hi, lo, len) => {
        gl.uniform3f(u.u_bpRangeX!, hi, lo, len)
        gl.uniform1ui(u.u_regionStart!, Math.floor(region.regionStart))
        gl.uniform1f(u.u_numRows!, region.numRows)
      },
    )
  }

  private glRenderMultiSingle(state: WebGLCanvasState, msg: Record<string, unknown>) {
    const renderState = msg.renderState as Record<string, unknown>
    const bpRangeX = msg.bpRangeX as [number, number]
    const canvasWidth = renderState.canvasWidth as number
    const canvasHeight = renderState.canvasHeight as number
    const { gl, canvas } = state

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const region = state.regions.get(0) ?? state.regions.values().next().value
    if (!region || region.featureCount === 0) {
      return
    }

    const isLine = renderState.renderingType === 2
    const isDensity = renderState.renderingType === 1

    let program: WebGLProgram
    let uniforms: Record<string, WebGLUniformLocation | null>
    if (isLine) {
      program = state.programs.multiLine
      uniforms = state.uniforms.multiLine
    } else if (isDensity) {
      program = state.programs.multiDensity
      uniforms = state.uniforms.multiDensity
    } else {
      program = state.programs.multiXyplot
      uniforms = state.uniforms.multiXyplot
    }

    gl.useProgram(program)
    this.setMultiUniforms(gl, uniforms, renderState)
    const [bpStartHi, bpStartLo] = splitPositionWithFrac(bpRangeX[0])
    const regionLengthBp = bpRangeX[1] - bpRangeX[0]
    gl.uniform3f(uniforms.u_bpRangeX!, bpStartHi, bpStartLo, regionLengthBp)
    gl.uniform1ui(uniforms.u_regionStart!, Math.floor(region.regionStart))
    gl.uniform1f(uniforms.u_numRows!, region.numRows)
    gl.uniform1f(uniforms.u_rowPadding!, renderState.rowPadding as number)

    const vao = isLine ? (region.lineVAO ?? region.featureVAO) : region.featureVAO
    gl.bindVertexArray(vao)
    if (isLine) {
      gl.drawArraysInstanced(gl.LINES, 0, 6, region.featureCount)
    } else {
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, region.featureCount)
    }
    gl.bindVertexArray(null)
  }
}
