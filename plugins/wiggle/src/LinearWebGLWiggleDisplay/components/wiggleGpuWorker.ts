/// <reference types="@webgpu/types" />
import { INSTANCE_STRIDE, wiggleShader } from './wiggleShaders.ts'
import {
  MULTI_INSTANCE_STRIDE,
  multiWiggleShader,
} from '../../LinearWebGLMultiWiggleDisplay/components/multiWiggleShaders.ts'

const UNIFORM_SIZE = 96
const MULTI_UNIFORM_SIZE = 48
const INSTANCE_BYTES = INSTANCE_STRIDE * 4
const MULTI_INSTANCE_BYTES = MULTI_INSTANCE_STRIDE * 4

interface RegionData {
  regionStart: number
  featureCount: number
  numRows: number
  instanceBuffer: GPUBuffer
  bindGroup: GPUBindGroup
}

interface CanvasState {
  canvas: OffscreenCanvas
  context: GPUCanvasContext
  width: number
  height: number
  regions: Map<number, RegionData>
}

let device: GPUDevice | null = null

let fillPipeline: GPURenderPipeline | null = null
let linePipeline: GPURenderPipeline | null = null
let bindGroupLayout: GPUBindGroupLayout | null = null
let uniformBuffer: GPUBuffer | null = null

let multiFillPipeline: GPURenderPipeline | null = null
let multiLinePipeline: GPURenderPipeline | null = null
let multiBindGroupLayout: GPUBindGroupLayout | null = null
let multiUniformBuffer: GPUBuffer | null = null

const canvases = new Map<number, CanvasState>()

const uniformData = new ArrayBuffer(UNIFORM_SIZE)
const uniformF32 = new Float32Array(uniformData)
const uniformI32 = new Int32Array(uniformData)
const uniformU32 = new Uint32Array(uniformData)

const multiUniformData = new ArrayBuffer(MULTI_UNIFORM_SIZE)
const multiUniformF32 = new Float32Array(multiUniformData)
const multiUniformI32 = new Int32Array(multiUniformData)
const multiUniformU32 = new Uint32Array(multiUniformData)

async function ensureDevice() {
  if (device) {
    return true
  }
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    return false
  }
  device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBufferBindingSize:
        adapter.limits.maxStorageBufferBindingSize ?? 134217728,
      maxBufferSize: adapter.limits.maxBufferSize ?? 268435456,
    },
  })
  device.lost.then(info => {
    console.error('[Wiggle GPU Worker] Device lost:', info.message)
    device = null
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
  const target: GPUColorTargetState = {
    format: 'bgra8unorm',
    blend: blendState,
  }

  uniformBuffer = device.createBuffer({
    size: UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  bindGroupLayout = device.createBindGroupLayout({
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
    bindGroupLayouts: [bindGroupLayout],
  })
  const shaderModule = device.createShaderModule({ code: wiggleShader })

  fillPipeline = device.createRenderPipeline({
    layout,
    vertex: { module: shaderModule, entryPoint: 'vs_main' },
    fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [target] },
    primitive: { topology: 'triangle-list' },
  })
  linePipeline = device.createRenderPipeline({
    layout,
    vertex: { module: shaderModule, entryPoint: 'vs_main' },
    fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [target] },
    primitive: { topology: 'line-list' },
  })

  multiUniformBuffer = device.createBuffer({
    size: MULTI_UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  multiBindGroupLayout = device.createBindGroupLayout({
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
    bindGroupLayouts: [multiBindGroupLayout],
  })
  const multiShaderModule = device.createShaderModule({
    code: multiWiggleShader,
  })

  multiFillPipeline = device.createRenderPipeline({
    layout: multiLayout,
    vertex: { module: multiShaderModule, entryPoint: 'vs_main' },
    fragment: { module: multiShaderModule, entryPoint: 'fs_main', targets: [target] },
    primitive: { topology: 'triangle-list' },
  })
  multiLinePipeline = device.createRenderPipeline({
    layout: multiLayout,
    vertex: { module: multiShaderModule, entryPoint: 'vs_main' },
    fragment: { module: multiShaderModule, entryPoint: 'fs_main', targets: [target] },
    primitive: { topology: 'line-list' },
  })

  return true
}

function splitPositionWithFrac(value: number): [number, number] {
  const intValue = Math.floor(value)
  const frac = value - intValue
  const loInt = intValue & 0xfff
  const hi = intValue - loInt
  const lo = loInt + frac
  return [hi, lo]
}

function interleaveInstances(
  positions: Uint32Array,
  scores: Float32Array,
  count: number,
) {
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

function interleaveMultiInstances(
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

function writeUniforms(
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
  uniformF32[0] = bpRangeHi
  uniformF32[1] = bpRangeLo
  uniformF32[2] = bpRangeLength
  uniformU32[3] = regionStart
  uniformF32[4] = canvasHeight
  uniformI32[5] = scaleType
  uniformI32[6] = renderingType
  uniformI32[7] = useBicolor
  uniformF32[8] = domainY[0]
  uniformF32[9] = domainY[1]
  uniformF32[10] = bicolorPivot
  uniformF32[11] = 0
  uniformF32[12] = color[0]
  uniformF32[13] = color[1]
  uniformF32[14] = color[2]
  uniformF32[15] = 0
  uniformF32[16] = posColor[0]
  uniformF32[17] = posColor[1]
  uniformF32[18] = posColor[2]
  uniformF32[19] = 0
  uniformF32[20] = negColor[0]
  uniformF32[21] = negColor[1]
  uniformF32[22] = negColor[2]
  uniformF32[23] = 0
  device!.queue.writeBuffer(uniformBuffer!, 0, uniformData)
}

function writeMultiUniforms(
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
  multiUniformF32[0] = bpRangeHi
  multiUniformF32[1] = bpRangeLo
  multiUniformF32[2] = bpRangeLength
  multiUniformU32[3] = regionStart
  multiUniformF32[4] = canvasHeight
  multiUniformI32[5] = scaleType
  multiUniformI32[6] = renderingType
  multiUniformF32[7] = numRows
  multiUniformF32[8] = domainY[0]
  multiUniformF32[9] = domainY[1]
  multiUniformF32[10] = rowPadding
  multiUniformF32[11] = 0
  device!.queue.writeBuffer(multiUniformBuffer!, 0, multiUniformData)
}

function clearCanvas(state: CanvasState) {
  const encoder = device!.createCommandEncoder()
  const textureView = state.context.getCurrentTexture().createView()
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: textureView,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
      },
    ],
  })
  pass.end()
  device!.queue.submit([encoder.finish()])
}

function renderBlocks(
  state: CanvasState,
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
    region: RegionData,
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
    const clippedBpStart =
      block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
    const clippedBpEnd =
      block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx
    const [bpStartHi, bpStartLo] = splitPositionWithFrac(clippedBpStart)
    const clippedLengthBp = clippedBpEnd - clippedBpStart

    writeUniformsFn(bpStartHi, bpStartLo, clippedLengthBp, region)

    const encoder = device!.createCommandEncoder()
    const textureView = state.context.getCurrentTexture().createView()

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: isFirst ? 'clear' : 'load',
          storeOp: 'store',
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

    device!.queue.submit([encoder.finish()])
    isFirst = false
  }

  if (isFirst) {
    clearCanvas(state)
  }
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data
  switch (msg.type) {
    case 'init': {
      try {
        const ok = await ensureDevice()
        if (!ok || !device) {
          self.postMessage({
            type: 'init-result',
            canvasId: msg.canvasId,
            success: false,
            error: 'No GPU adapter',
          })
          return
        }

        const canvas = msg.canvas as OffscreenCanvas
        const context = canvas.getContext('webgpu')!
        context.configure({
          device,
          format: 'bgra8unorm',
          alphaMode: 'premultiplied',
        })

        canvases.set(msg.canvasId, {
          canvas,
          context,
          width: canvas.width,
          height: canvas.height,
          regions: new Map(),
        })

        self.postMessage({
          type: 'init-result',
          canvasId: msg.canvasId,
          success: true,
        })
      } catch (err) {
        self.postMessage({
          type: 'init-result',
          canvasId: msg.canvasId,
          success: false,
          error: String(err),
        })
      }
      break
    }

    case 'resize': {
      const state = canvases.get(msg.canvasId)
      if (!state) {
        break
      }
      state.width = msg.width
      state.height = msg.height
      state.canvas.width = msg.width
      state.canvas.height = msg.height
      break
    }

    case 'upload-region': {
      if (!device || !bindGroupLayout || !uniformBuffer) {
        break
      }
      const state = canvases.get(msg.canvasId)
      if (!state) {
        break
      }

      const old = state.regions.get(msg.regionNumber)
      if (old) {
        old.instanceBuffer.destroy()
      }

      if (msg.numFeatures === 0) {
        state.regions.delete(msg.regionNumber)
        break
      }

      const interleaved = interleaveInstances(
        msg.featurePositions,
        msg.featureScores,
        msg.numFeatures,
      )

      const instanceBuffer = device.createBuffer({
        size: interleaved.byteLength || 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      })
      device.queue.writeBuffer(instanceBuffer, 0, interleaved)

      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: instanceBuffer } },
          { binding: 1, resource: { buffer: uniformBuffer } },
        ],
      })

      state.regions.set(msg.regionNumber, {
        regionStart: msg.regionStart,
        featureCount: msg.numFeatures,
        numRows: 1,
        instanceBuffer,
        bindGroup,
      })
      break
    }

    case 'upload-multi-region': {
      if (!device || !multiBindGroupLayout || !multiUniformBuffer) {
        break
      }
      const state = canvases.get(msg.canvasId)
      if (!state) {
        break
      }

      const old = state.regions.get(msg.regionNumber)
      if (old) {
        old.instanceBuffer.destroy()
      }

      if (msg.totalFeatures === 0) {
        state.regions.delete(msg.regionNumber)
        break
      }

      const interleaved = interleaveMultiInstances(
        msg.positions,
        msg.scores,
        msg.prevScores,
        msg.rowIndices,
        msg.colors,
        msg.totalFeatures,
      )

      const instanceBuffer = device.createBuffer({
        size: interleaved.byteLength || 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      })
      device.queue.writeBuffer(instanceBuffer, 0, interleaved)

      const bindGroup = device.createBindGroup({
        layout: multiBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: instanceBuffer } },
          { binding: 1, resource: { buffer: multiUniformBuffer } },
        ],
      })

      state.regions.set(msg.regionNumber, {
        regionStart: msg.regionStart,
        featureCount: msg.totalFeatures,
        numRows: msg.numRows,
        instanceBuffer,
        bindGroup,
      })
      break
    }

    case 'prune-regions': {
      const state = canvases.get(msg.canvasId)
      if (!state) {
        break
      }
      const active = new Set<number>(msg.activeRegions)
      for (const [num, region] of state.regions) {
        if (!active.has(num)) {
          region.instanceBuffer.destroy()
          state.regions.delete(num)
        }
      }
      break
    }

    case 'render': {
      if (!device || !fillPipeline || !linePipeline || !uniformBuffer) {
        break
      }
      const state = canvases.get(msg.canvasId)
      if (!state) {
        break
      }

      const { blocks, renderState } = msg
      const { canvasWidth, canvasHeight } = renderState
      const isLine = renderState.renderingType === 2
      const pipeline = isLine ? linePipeline : fillPipeline

      renderBlocks(
        state,
        blocks,
        canvasWidth,
        canvasHeight,
        pipeline,
        (hi, lo, len, region) => {
          writeUniforms(
            hi, lo, len,
            Math.floor(region.regionStart),
            canvasHeight,
            renderState.scaleType,
            renderState.renderingType,
            renderState.useBicolor,
            renderState.domainY,
            renderState.bicolorPivot,
            renderState.color,
            renderState.posColor,
            renderState.negColor,
          )
        },
      )
      break
    }

    case 'render-single': {
      if (!device || !fillPipeline || !linePipeline || !uniformBuffer) {
        break
      }
      const state = canvases.get(msg.canvasId)
      if (!state) {
        break
      }

      const { renderState, bpRangeX } = msg
      const { canvasWidth, canvasHeight } = renderState
      const isLine = renderState.renderingType === 2
      const pipeline = isLine ? linePipeline : fillPipeline

      if (state.canvas.width !== canvasWidth || state.canvas.height !== canvasHeight) {
        state.canvas.width = canvasWidth
        state.canvas.height = canvasHeight
      }

      const region =
        state.regions.get(0) ?? state.regions.values().next().value
      if (!region || region.featureCount === 0) {
        clearCanvas(state)
        break
      }

      const [bpStartHi, bpStartLo] = splitPositionWithFrac(bpRangeX[0])
      const regionLengthBp = bpRangeX[1] - bpRangeX[0]

      writeUniforms(
        bpStartHi, bpStartLo, regionLengthBp,
        Math.floor(region.regionStart),
        canvasHeight,
        renderState.scaleType,
        renderState.renderingType,
        renderState.useBicolor,
        renderState.domainY,
        renderState.bicolorPivot,
        renderState.color,
        renderState.posColor,
        renderState.negColor,
      )

      const encoder = device.createCommandEncoder()
      const textureView = state.context.getCurrentTexture().createView()
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          },
        ],
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, region.bindGroup)
      pass.setViewport(0, 0, canvasWidth, canvasHeight, 0, 1)
      pass.draw(6, region.featureCount)
      pass.end()
      device.queue.submit([encoder.finish()])
      break
    }

    case 'render-multi': {
      if (!device || !multiFillPipeline || !multiLinePipeline || !multiUniformBuffer) {
        break
      }
      const state = canvases.get(msg.canvasId)
      if (!state) {
        break
      }

      const { blocks, renderState } = msg
      const { canvasWidth, canvasHeight } = renderState
      const isLine = renderState.renderingType === 2
      const pipeline = isLine ? multiLinePipeline : multiFillPipeline

      renderBlocks(
        state,
        blocks,
        canvasWidth,
        canvasHeight,
        pipeline,
        (hi, lo, len, region) => {
          writeMultiUniforms(
            hi, lo, len,
            Math.floor(region.regionStart),
            canvasHeight,
            renderState.scaleType,
            renderState.renderingType,
            region.numRows,
            renderState.domainY,
            renderState.rowPadding,
          )
        },
      )
      break
    }

    case 'render-multi-single': {
      if (!device || !multiFillPipeline || !multiLinePipeline || !multiUniformBuffer) {
        break
      }
      const state = canvases.get(msg.canvasId)
      if (!state) {
        break
      }

      const { renderState, bpRangeX } = msg
      const { canvasWidth, canvasHeight } = renderState
      const isLine = renderState.renderingType === 2
      const pipeline = isLine ? multiLinePipeline : multiFillPipeline

      if (state.canvas.width !== canvasWidth || state.canvas.height !== canvasHeight) {
        state.canvas.width = canvasWidth
        state.canvas.height = canvasHeight
      }

      const region =
        state.regions.get(0) ?? state.regions.values().next().value
      if (!region || region.featureCount === 0) {
        clearCanvas(state)
        break
      }

      const [bpStartHi, bpStartLo] = splitPositionWithFrac(bpRangeX[0])
      const regionLengthBp = bpRangeX[1] - bpRangeX[0]

      writeMultiUniforms(
        bpStartHi, bpStartLo, regionLengthBp,
        Math.floor(region.regionStart),
        canvasHeight,
        renderState.scaleType,
        renderState.renderingType,
        region.numRows,
        renderState.domainY,
        renderState.rowPadding,
      )

      const encoder = device.createCommandEncoder()
      const textureView = state.context.getCurrentTexture().createView()
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          },
        ],
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, region.bindGroup)
      pass.setViewport(0, 0, canvasWidth, canvasHeight, 0, 1)
      pass.draw(6, region.featureCount)
      pass.end()
      device.queue.submit([encoder.finish()])
      break
    }

    case 'dispose': {
      const state = canvases.get(msg.canvasId)
      if (state) {
        for (const region of state.regions.values()) {
          region.instanceBuffer.destroy()
        }
        canvases.delete(msg.canvasId)
      }
      break
    }
  }
}
