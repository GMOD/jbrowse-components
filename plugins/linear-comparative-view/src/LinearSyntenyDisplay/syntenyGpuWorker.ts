/// <reference types="@webgpu/types" />
import {
  EDGE_SEGMENTS,
  EDGE_VERTS_PER_INSTANCE,
  FILL_SEGMENTS,
  FILL_VERTS_PER_INSTANCE,
  INSTANCE_BYTE_SIZE,
  edgeVertexShader,
  fillVertexShader,
} from './syntenyShaders.ts'

let device: GPUDevice | null = null
let context: GPUCanvasContext | null = null
let canvas: OffscreenCanvas | null = null

let fillPipeline: GPURenderPipeline | null = null
let fillPickingPipeline: GPURenderPipeline | null = null
let edgePipeline: GPURenderPipeline | null = null

let renderBindGroupLayout: GPUBindGroupLayout | null = null

let instanceBuffer: GPUBuffer | null = null
let uniformBuffer: GPUBuffer | null = null
let renderBindGroup: GPUBindGroup | null = null

let pickingTexture: GPUTexture | null = null
let pickingStagingBuffer: GPUBuffer | null = null

let instanceCount = 0
let nonCigarInstanceCount = 0
let geometryBpPerPx0 = 1
let geometryBpPerPx1 = 1
let canvasWidth = 0
let canvasHeight = 0
let logicalWidth = 0
let logicalHeight = 0
let dpr = 2

const UNIFORM_SIZE = 80
const uniformData = new ArrayBuffer(UNIFORM_SIZE)
const uniformF32 = new Float32Array(uniformData)
const uniformU32 = new Uint32Array(uniformData)

function createPipelines() {
  if (!device) {
    return
  }

  renderBindGroupLayout = device.createBindGroupLayout({
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
    bindGroupLayouts: [renderBindGroupLayout],
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
  fillPipeline = device.createRenderPipeline({
    layout: renderLayout,
    vertex: { module: fillModule, entryPoint: 'vs_main' },
    fragment: {
      module: fillModule,
      entryPoint: 'fs_main',
      targets: [{ format: 'bgra8unorm', blend: blendState }],
    },
    primitive: { topology: 'triangle-list' },
  })

  fillPickingPipeline = device.createRenderPipeline({
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
  edgePipeline = device.createRenderPipeline({
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

function createPickingTexture() {
  if (!device || canvasWidth === 0 || canvasHeight === 0) {
    return
  }
  pickingTexture?.destroy()
  pickingTexture = device.createTexture({
    size: [canvasWidth, canvasHeight],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  })
}

function writeUniforms(
  height: number,
  adjOff0Hi: number,
  adjOff0Lo: number,
  adjOff1Hi: number,
  adjOff1Lo: number,
  scale0: number,
  scale1: number,
  maxOffScreenPx: number,
  minAlignmentLength: number,
  alpha: number,
  hoveredFeatureId: number,
  clickedFeatureId: number,
) {
  if (!device || !uniformBuffer) {
    return
  }
  uniformF32[0] = logicalWidth
  uniformF32[1] = logicalHeight
  uniformF32[2] = height
  uniformF32[3] = 0
  uniformF32[4] = adjOff0Hi
  uniformF32[5] = adjOff0Lo
  uniformF32[6] = adjOff1Hi
  uniformF32[7] = adjOff1Lo
  uniformF32[8] = scale0
  uniformF32[9] = scale1
  uniformF32[10] = maxOffScreenPx
  uniformF32[11] = minAlignmentLength
  uniformF32[12] = alpha
  uniformU32[13] = instanceCount
  uniformU32[14] = FILL_SEGMENTS
  uniformU32[15] = EDGE_SEGMENTS
  uniformF32[16] = hoveredFeatureId
  uniformF32[17] = clickedFeatureId
  uniformF32[18] = 0
  uniformF32[19] = 0
  device.queue.writeBuffer(uniformBuffer, 0, uniformData)
}

function interleaveInstances(
  x1: Float32Array,
  x2: Float32Array,
  x3: Float32Array,
  x4: Float32Array,
  colors: Float32Array,
  featureIds: Float32Array,
  isCurves: Float32Array,
  queryTotalLengths: Float32Array,
  padTops: Float32Array,
  padBottoms: Float32Array,
  n: number,
) {
  const buf = new ArrayBuffer(n * INSTANCE_BYTE_SIZE)
  const f = new Float32Array(buf)
  const stride = INSTANCE_BYTE_SIZE / 4

  for (let i = 0; i < n; i++) {
    const off = i * stride
    f[off] = x1[i * 2]!
    f[off + 1] = x1[i * 2 + 1]!
    f[off + 2] = x2[i * 2]!
    f[off + 3] = x2[i * 2 + 1]!
    f[off + 4] = x3[i * 2]!
    f[off + 5] = x3[i * 2 + 1]!
    f[off + 6] = x4[i * 2]!
    f[off + 7] = x4[i * 2 + 1]!
    f[off + 8] = colors[i * 4]!
    f[off + 9] = colors[i * 4 + 1]!
    f[off + 10] = colors[i * 4 + 2]!
    f[off + 11] = colors[i * 4 + 3]!
    f[off + 12] = featureIds[i]!
    f[off + 13] = isCurves[i]!
    f[off + 14] = queryTotalLengths[i]!
    f[off + 15] = padTops[i]!
    f[off + 16] = padBottoms[i]!
    f[off + 17] = 0
    f[off + 18] = 0
    f[off + 19] = 0
  }
  return buf
}

function rebuildBindGroups() {
  if (!device || !instanceBuffer || !uniformBuffer) {
    return
  }

  renderBindGroup = device.createBindGroup({
    layout: renderBindGroupLayout!,
    entries: [
      { binding: 0, resource: { buffer: instanceBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } },
    ],
  })
}

function encodeDrawPass(
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
        storeOp: 'store',
        ...(clearValue && { clearValue }),
      },
    ],
  })
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, renderBindGroup)
  pass.draw(vertexCount, drawInstanceCount ?? instanceCount)
  pass.end()
}

function computeHpOffsets(offset: number, scale: number) {
  const adj = offset / scale
  const hi = Math.fround(adj)
  return { hi, lo: adj - hi }
}

let lastRenderParams = {
  height: 0,
  adjOff0Hi: 0,
  adjOff0Lo: 0,
  adjOff1Hi: 0,
  adjOff1Lo: 0,
  scale0: 1,
  scale1: 1,
  maxOffScreenPx: 300,
  minAlignmentLength: 0,
  alpha: 1,
  hoveredFeatureId: 0,
  clickedFeatureId: 0,
}
let pickingDirty = true

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data
  switch (msg.type) {
    case 'init': {
      try {
        canvas = msg.canvas as OffscreenCanvas
        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter) {
          self.postMessage({
            type: 'init-result',
            success: false,
            error: 'No GPU adapter',
          })
          return
        }
        device = await adapter.requestDevice()
        device.lost.then(info => {
          console.error('[WebGPU Worker] Device lost:', info.message)
          device = null
        })

        context = canvas.getContext('webgpu')!
        context.configure({ device, format: 'bgra8unorm', alphaMode: 'opaque' })

        uniformBuffer = device.createBuffer({
          size: UNIFORM_SIZE,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        pickingStagingBuffer = device.createBuffer({
          size: 256,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        })

        createPipelines()
        self.postMessage({ type: 'init-result', success: true })
      } catch (err) {
        self.postMessage({
          type: 'init-result',
          success: false,
          error: String(err),
        })
      }
      break
    }

    case 'resize': {
      if (!device || !context || !canvas) {
        break
      }
      logicalWidth = msg.width
      logicalHeight = msg.height
      dpr = msg.dpr ?? 2
      canvasWidth = Math.round(logicalWidth * dpr)
      canvasHeight = Math.round(logicalHeight * dpr)
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      createPickingTexture()
      break
    }

    case 'upload-geometry': {
      if (!device) {
        break
      }
      instanceCount = msg.instanceCount
      nonCigarInstanceCount = msg.nonCigarInstanceCount ?? msg.instanceCount
      geometryBpPerPx0 = msg.geometryBpPerPx0
      geometryBpPerPx1 = msg.geometryBpPerPx1

      const interleaved = interleaveInstances(
        msg.x1,
        msg.x2,
        msg.x3,
        msg.x4,
        msg.colors,
        msg.featureIds,
        msg.isCurves,
        msg.queryTotalLengths,
        msg.padTops,
        msg.padBottoms,
        instanceCount,
      )

      instanceBuffer?.destroy()
      instanceBuffer = device.createBuffer({
        size: interleaved.byteLength || 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      })
      device.queue.writeBuffer(instanceBuffer, 0, interleaved)

      rebuildBindGroups()
      pickingDirty = true
      break
    }

    case 'render': {
      if (
        !device ||
        !context ||
        !canvas ||
        !instanceBuffer ||
        instanceCount === 0
      ) {
        break
      }
      if (!renderBindGroup || !fillPipeline) {
        break
      }

      const scale0 = geometryBpPerPx0 / msg.curBpPerPx0
      const scale1 = geometryBpPerPx1 / msg.curBpPerPx1
      const off0 = computeHpOffsets(msg.offset0, scale0)
      const off1 = computeHpOffsets(msg.offset1, scale1)

      const hoveredFeatureId = msg.hoveredFeatureId ?? 0
      const clickedFeatureId = msg.clickedFeatureId ?? 0

      writeUniforms(
        msg.height,
        off0.hi,
        off0.lo,
        off1.hi,
        off1.lo,
        scale0,
        scale1,
        msg.maxOffScreenPx,
        msg.minAlignmentLength,
        msg.alpha,
        hoveredFeatureId,
        clickedFeatureId,
      )

      lastRenderParams = {
        height: msg.height,
        adjOff0Hi: off0.hi,
        adjOff0Lo: off0.lo,
        adjOff1Hi: off1.hi,
        adjOff1Lo: off1.lo,
        scale0,
        scale1,
        maxOffScreenPx: msg.maxOffScreenPx,
        minAlignmentLength: msg.minAlignmentLength,
        alpha: msg.alpha,
        hoveredFeatureId,
        clickedFeatureId,
      }
      pickingDirty = true

      const encoder = device.createCommandEncoder()
      const tv = context.getCurrentTexture().createView()
      const white = { r: 1, g: 1, b: 1, a: 1 }

      encodeDrawPass(
        encoder,
        tv,
        fillPipeline,
        FILL_VERTS_PER_INSTANCE,
        'clear',
        white,
      )
      if (edgePipeline && clickedFeatureId > 0) {
        encodeDrawPass(
          encoder,
          tv,
          edgePipeline,
          EDGE_VERTS_PER_INSTANCE,
          'load',
          undefined,
          nonCigarInstanceCount,
        )
      }

      device.queue.submit([encoder.finish()])
      break
    }

    case 'pick': {
      if (
        !device ||
        !canvas ||
        !instanceBuffer ||
        instanceCount === 0 ||
        !pickingTexture ||
        !pickingStagingBuffer
      ) {
        self.postMessage({ type: 'pick-result', featureIndex: -1 })
        break
      }
      if (!fillPickingPipeline || !renderBindGroup) {
        self.postMessage({ type: 'pick-result', featureIndex: -1 })
        break
      }

      if (pickingDirty) {
        const p = lastRenderParams
        writeUniforms(
          p.height,
          p.adjOff0Hi,
          p.adjOff0Lo,
          p.adjOff1Hi,
          p.adjOff1Lo,
          p.scale0,
          p.scale1,
          p.maxOffScreenPx,
          p.minAlignmentLength,
          1,
          0,
          0,
        )

        const encoder = device.createCommandEncoder()
        const pv = pickingTexture.createView()
        const transparent = { r: 0, g: 0, b: 0, a: 0 }

        encodeDrawPass(
          encoder,
          pv,
          fillPickingPipeline,
          FILL_VERTS_PER_INSTANCE,
          'clear',
          transparent,
        )

        device.queue.submit([encoder.finish()])
        pickingDirty = false
      }

      const px = Math.floor(msg.x * dpr)
      const py = Math.floor(msg.y * dpr)

      if (px < 0 || px >= canvasWidth || py < 0 || py >= canvasHeight) {
        self.postMessage({ type: 'pick-result', featureIndex: -1 })
        break
      }

      const encoder = device.createCommandEncoder()
      encoder.copyTextureToBuffer(
        { texture: pickingTexture, origin: [px, py, 0] },
        { buffer: pickingStagingBuffer, bytesPerRow: 256 },
        [1, 1, 1],
      )
      device.queue.submit([encoder.finish()])

      await pickingStagingBuffer.mapAsync(GPUMapMode.READ)
      const data = new Uint8Array(pickingStagingBuffer.getMappedRange())
      const r = data[0]!
      const g = data[1]!
      const b = data[2]!
      pickingStagingBuffer.unmap()

      const featureIndex =
        r === 0 && g === 0 && b === 0 ? -1 : r + g * 256 + b * 65536 - 1
      self.postMessage({ type: 'pick-result', featureIndex })
      break
    }

    case 'dispose': {
      instanceBuffer?.destroy()
      uniformBuffer?.destroy()
      pickingTexture?.destroy()
      pickingStagingBuffer?.destroy()
      device?.destroy()
      device = null
      context = null
      canvas = null
      instanceBuffer = null
      uniformBuffer = null
      pickingTexture = null
      pickingStagingBuffer = null
      break
    }
  }
}
