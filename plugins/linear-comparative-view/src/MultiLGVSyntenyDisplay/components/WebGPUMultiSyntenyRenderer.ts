/// <reference types="@webgpu/types" />

import { getDevicePixelRatio, resizeCanvas } from '@jbrowse/alignments-core'
import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'
import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'
import {
  STANDARD_BLEND_STATE,
  createStandardBindGroup,
  createStandardBindGroupLayout,
  createStorageBuffer,
} from '@jbrowse/core/gpu/webgpuUtils'

import { computeRegionRenderParams } from './multiSyntenyGpuData.ts'
import {
  UNIFORM_BYTE_SIZE,
  WGSL_FILL_SHADER,
} from './multiSyntenyGpuShaders.ts'

import type { MultiSyntenyGpuBackend } from './multiSyntenyBackendTypes.ts'
import type { MultiSyntenyGpuInstanceData } from './multiSyntenyGpuData.ts'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

export class WebGPUMultiSyntenyRenderer implements MultiSyntenyGpuBackend {
  private static device: GPUDevice | null = null
  private static fillPipeline: GPURenderPipeline | null = null
  private static pickingPipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null
  private static pipelinesReady: Promise<void> | null = null

  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext
  private uniformBuffer: GPUBuffer
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)

  private instanceBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private instanceData: MultiSyntenyGpuInstanceData | null = null

  private constructor(
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    device: GPUDevice,
  ) {
    this.canvas = canvas
    this.context = context
    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_BYTE_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  static async create(canvas: HTMLCanvasElement) {
    const device = await WebGPUMultiSyntenyRenderer.ensureDevice()
    if (!device) {
      return null
    }
    const result = await initGpuContext(canvas, { alphaMode: 'opaque' })
    if (!result) {
      return null
    }
    return new WebGPUMultiSyntenyRenderer(canvas, result.context, device)
  }

  private static async ensureDevice() {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    if (WebGPUMultiSyntenyRenderer.device !== device) {
      WebGPUMultiSyntenyRenderer.device = device
      WebGPUMultiSyntenyRenderer.pipelinesReady =
        WebGPUMultiSyntenyRenderer.initPipelines(device)
    }
    await WebGPUMultiSyntenyRenderer.pipelinesReady
    return device
  }

  private static async initPipelines(device: GPUDevice) {
    WebGPUMultiSyntenyRenderer.bindGroupLayout =
      createStandardBindGroupLayout(device)

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [WebGPUMultiSyntenyRenderer.bindGroupLayout],
    })

    const module = device.createShaderModule({ code: WGSL_FILL_SHADER })

    ;[
      WebGPUMultiSyntenyRenderer.fillPipeline,
      WebGPUMultiSyntenyRenderer.pickingPipeline,
    ] = await Promise.all([
      device.createRenderPipelineAsync({
        layout,
        vertex: { module, entryPoint: 'vs_main' },
        fragment: {
          module,
          entryPoint: 'fs_main',
          targets: [{ format: 'bgra8unorm', blend: STANDARD_BLEND_STATE }],
        },
        primitive: { topology: 'triangle-list' },
      }),
      device.createRenderPipelineAsync({
        layout,
        vertex: { module, entryPoint: 'vs_main' },
        fragment: {
          module,
          entryPoint: 'fs_picking',
          targets: [{ format: 'rgba8unorm' }],
        },
        primitive: { topology: 'triangle-list' },
      }),
    ])
  }

  resize(width: number, height: number) {
    resizeCanvas(this.canvas, width, height)
  }

  uploadGeometry(data: MultiSyntenyGpuInstanceData) {
    const device = WebGPUMultiSyntenyRenderer.device
    if (!device || !WebGPUMultiSyntenyRenderer.bindGroupLayout) {
      return
    }

    this.instanceData = data

    this.instanceBuffer?.destroy()
    this.instanceBuffer = createStorageBuffer(device, data.buffer)

    this.bindGroup = createStandardBindGroup(
      device,
      WebGPUMultiSyntenyRenderer.bindGroupLayout,
      this.instanceBuffer,
      this.uniformBuffer,
    )
  }

  render(
    contentBlocks: BaseBlock[],
    viewOffsetPx: number,
    width: number,
    height: number,
    rowHeight: number,
    rowSpacing: boolean,
  ) {
    const device = WebGPUMultiSyntenyRenderer.device
    if (
      !device ||
      !this.instanceBuffer ||
      !this.instanceData ||
      this.instanceData.instanceCount === 0 ||
      !this.bindGroup ||
      !WebGPUMultiSyntenyRenderer.fillPipeline
    ) {
      return
    }

    this.resize(width, height)
    const dpr = getDevicePixelRatio()
    const logicalW = this.canvas.width / dpr
    const logicalH = this.canvas.height / dpr
    const rowPadding = rowSpacing ? 1 : 0

    const tv = this.context.getCurrentTexture().createView()

    let isFirstPass = true

    // Each region needs its own submit because writeBuffer is a queue
    // operation that must complete before the render pass reads the uniform
    for (const block of contentBlocks) {
      const params = computeRegionRenderParams(
        block,
        viewOffsetPx,
        this.instanceData.refNameIndex,
      )
      if (!params) {
        continue
      }
      if (
        params.regionScreenLeft + params.regionScreenWidth < 0 ||
        params.regionScreenLeft > logicalW
      ) {
        continue
      }

      this.writeUniforms(
        device,
        logicalW,
        logicalH,
        rowHeight,
        params.bpRangeHi,
        params.bpRangeLo,
        params.bpRangeLen,
        params.regionScreenLeft,
        params.regionScreenWidth,
        rowPadding,
      )

      const encoder = device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: tv,
            loadOp: isFirstPass
              ? ('clear' as GPULoadOp)
              : ('load' as GPULoadOp),
            storeOp: 'store' as GPUStoreOp,
            ...(isFirstPass && {
              clearValue: { r: 0.93, g: 0.93, b: 0.93, a: 1 },
            }),
          },
        ],
      })
      pass.setPipeline(WebGPUMultiSyntenyRenderer.fillPipeline)
      pass.setBindGroup(0, this.bindGroup)
      pass.draw(6, params.instanceCount, 0, params.instanceOffset)
      pass.end()
      device.queue.submit([encoder.finish()])
      isFirstPass = false
    }

    // If no regions were drawn, still clear the canvas
    if (isFirstPass) {
      const encoder = device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: tv,
            loadOp: 'clear' as GPULoadOp,
            storeOp: 'store' as GPUStoreOp,
            clearValue: { r: 0.93, g: 0.93, b: 0.93, a: 1 },
          },
        ],
      })
      pass.end()
      device.queue.submit([encoder.finish()])
    }
  }

  pick(_x: number, _y: number) {
    return -1
  }

  dispose() {
    this.instanceBuffer?.destroy()
    this.instanceBuffer = null
    this.bindGroup = null
    this.uniformBuffer.destroy()
  }

  private writeUniforms(
    device: GPUDevice,
    width: number,
    height: number,
    rowHeight: number,
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLen: number,
    regionScreenLeft: number,
    regionScreenWidth: number,
    rowPadding: number,
  ) {
    const f = this.uniformF32
    f[0] = width
    f[1] = height
    f[2] = rowHeight
    f[3] = 0
    f[4] = bpRangeHi
    f[5] = bpRangeLo
    f[6] = bpRangeLen
    f[7] = regionScreenLeft
    f[8] = regionScreenWidth
    f[9] = 0 // hpZero — MUST be 0.0 at runtime
    f[10] = rowPadding
    f[11] = 0
    f[12] = 0
    f[13] = 0
    f[14] = 0
    f[15] = 0
    device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData)
  }
}
