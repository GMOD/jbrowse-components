/// <reference types="@webgpu/types" />

import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'

import type { Renderer, RenderBatch, TransformUniform } from './types.ts'

const shaderSource = `
struct Uniforms {
  scale: vec2f,
  translate: vec2f,
  viewport: vec2f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let screen = input.position * u.scale + u.translate;
  let clip = (screen / u.viewport) * 2.0 - 1.0;
  out.position = vec4f(clip.x, -clip.y, 0.0, 1.0);
  out.color = input.color;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
`

export class WebGPURenderer implements Renderer {
  private device: GPUDevice
  private context: GPUCanvasContext
  private pipeline: GPURenderPipeline
  private uniformBuffer: GPUBuffer
  private uniformBindGroup: GPUBindGroup
  private positionBuffer: GPUBuffer | null = null
  private colorBuffer: GPUBuffer | null = null
  private indexBuffer: GPUBuffer | null = null
  private indexCount = 0

  private constructor(
    device: GPUDevice,
    context: GPUCanvasContext,
    pipeline: GPURenderPipeline,
    uniformBuffer: GPUBuffer,
    uniformBindGroup: GPUBindGroup,
  ) {
    this.device = device
    this.context = context
    this.pipeline = pipeline
    this.uniformBuffer = uniformBuffer
    this.uniformBindGroup = uniformBindGroup
  }

  static async create(canvas: HTMLCanvasElement) {
    const result = await initGpuContext(canvas, { alphaMode: 'opaque' })
    if (!result) {
      return null
    }
    const { device, context } = result
    const module = device.createShaderModule({ code: shaderSource })

    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 8,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
          },
          {
            arrayStride: 16,
            attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }],
          },
        ],
      },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [
          {
            format: 'bgra8unorm',
            blend: {
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
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    })

    const uniformBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const uniformBindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })

    return new WebGPURenderer(device, context, pipeline, uniformBuffer, uniformBindGroup)
  }

  resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1
    const canvas = this.context.canvas as HTMLCanvasElement
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
  }

  private createBuffer(data: ArrayBufferView, usage: GPUBufferUsageFlags) {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(buffer, 0, data)
    return buffer
  }

  uploadGeometry(batch: RenderBatch) {
    this.positionBuffer?.destroy()
    this.colorBuffer?.destroy()
    this.indexBuffer?.destroy()

    this.positionBuffer = this.createBuffer(batch.positions, GPUBufferUsage.VERTEX)
    this.colorBuffer = this.createBuffer(batch.colors, GPUBufferUsage.VERTEX)
    this.indexBuffer = this.createBuffer(batch.indices, GPUBufferUsage.INDEX)
    this.indexCount = batch.indices.length
  }

  updateTransform(t: TransformUniform) {
    const data = new Float32Array([
      t.scaleX, t.scaleY,
      t.translateX, t.translateY,
      t.viewportWidth, t.viewportHeight,
      0, 0,
    ])
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data)
  }

  render(clearColor: [number, number, number, number]) {
    if (!this.positionBuffer || this.indexCount === 0) {
      return
    }

    const textureView = this.context.getCurrentTexture().createView()
    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: clearColor[3] },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })

    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.uniformBindGroup)
    pass.setVertexBuffer(0, this.positionBuffer)
    pass.setVertexBuffer(1, this.colorBuffer!)
    pass.setIndexBuffer(this.indexBuffer!, 'uint32')
    pass.drawIndexed(this.indexCount)

    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  destroy() {
    this.positionBuffer?.destroy()
    this.colorBuffer?.destroy()
    this.indexBuffer?.destroy()
    this.uniformBuffer.destroy()
    this.positionBuffer = null
    this.colorBuffer = null
    this.indexBuffer = null
  }
}
