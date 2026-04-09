/// <reference types="@webgpu/types" />

import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'

import type {
  RenderBatch,
  Renderer,
  SubBatch,
  TransformUniform,
} from './types.ts'

const shaderSource = `
struct Uniforms {
  scale: vec2f,
  translate: vec2f,
  viewport: vec2f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) normal: vec2f,
  @location(2) thickness: f32,
  @location(3) color: vec4f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let expanded = input.position + input.normal * input.thickness / u.scale.x;
  let screen = expanded * u.scale + u.translate;
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

interface SubBatchBuffers {
  positionBuffer: GPUBuffer
  normalBuffer: GPUBuffer
  thicknessBuffer: GPUBuffer
  colorBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  indexCount: number
}

export class WebGPURenderer implements Renderer {
  private device: GPUDevice
  private context: GPUCanvasContext
  private pipeline: GPURenderPipeline
  private uniformBuffer: GPUBuffer
  private uniformBindGroup: GPUBindGroup
  private edgeBuffers: SubBatchBuffers | null = null
  private nodeBuffers: SubBatchBuffers | null = null
  private arrowBuffers: SubBatchBuffers | null = null

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
    const result = await initGpuContext(canvas, { alphaMode: 'premultiplied' })
    if (!result) {
      return null
    }
    const { device, context } = result
    const format = navigator.gpu.getPreferredCanvasFormat()
    const module = device.createShaderModule({ code: shaderSource })

    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 8,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x2' as GPUVertexFormat,
              },
            ],
          },
          {
            arrayStride: 8,
            attributes: [
              {
                shaderLocation: 1,
                offset: 0,
                format: 'float32x2' as GPUVertexFormat,
              },
            ],
          },
          {
            arrayStride: 4,
            attributes: [
              {
                shaderLocation: 2,
                offset: 0,
                format: 'float32' as GPUVertexFormat,
              },
            ],
          },
          {
            arrayStride: 16,
            attributes: [
              {
                shaderLocation: 3,
                offset: 0,
                format: 'float32x4' as GPUVertexFormat,
              },
            ],
          },
        ],
      },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [
          {
            format,
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

    return new WebGPURenderer(
      device,
      context,
      pipeline,
      uniformBuffer,
      uniformBindGroup,
    )
  }

  resize(width: number, height: number) {
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    const canvas = this.context.canvas as HTMLCanvasElement
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
  }

  private createBuffer(data: ArrayBufferView, usage: GPUBufferUsageFlags) {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(buffer, 0, data)
    return buffer
  }

  private createSubBatchBuffers(batch: SubBatch): SubBatchBuffers {
    return {
      positionBuffer: this.createBuffer(batch.positions, GPUBufferUsage.VERTEX),
      normalBuffer: this.createBuffer(batch.normals, GPUBufferUsage.VERTEX),
      thicknessBuffer: this.createBuffer(
        batch.thicknesses,
        GPUBufferUsage.VERTEX,
      ),
      colorBuffer: this.createBuffer(batch.colors, GPUBufferUsage.VERTEX),
      indexBuffer: this.createBuffer(batch.indices, GPUBufferUsage.INDEX),
      indexCount: batch.indices.length,
    }
  }

  private destroySubBatchBuffers(buffers: SubBatchBuffers) {
    buffers.positionBuffer.destroy()
    buffers.normalBuffer.destroy()
    buffers.thicknessBuffer.destroy()
    buffers.colorBuffer.destroy()
    buffers.indexBuffer.destroy()
  }

  uploadGeometry(batch: RenderBatch) {
    if (this.edgeBuffers) {
      this.destroySubBatchBuffers(this.edgeBuffers)
    }
    if (this.nodeBuffers) {
      this.destroySubBatchBuffers(this.nodeBuffers)
    }
    if (this.arrowBuffers) {
      this.destroySubBatchBuffers(this.arrowBuffers)
    }

    this.edgeBuffers =
      batch.edges.indices.length > 0
        ? this.createSubBatchBuffers(batch.edges)
        : null
    this.nodeBuffers =
      batch.nodes.indices.length > 0
        ? this.createSubBatchBuffers(batch.nodes)
        : null
    this.arrowBuffers =
      batch.arrows.indices.length > 0
        ? this.createSubBatchBuffers(batch.arrows)
        : null
  }

  updateSubBatchColors(
    target: 'edges' | 'nodes' | 'arrows',
    colors: Float32Array,
    vertexStart: number,
  ) {
    const buffers =
      target === 'edges'
        ? this.edgeBuffers
        : target === 'nodes'
          ? this.nodeBuffers
          : this.arrowBuffers
    if (!buffers) {
      return
    }
    this.device.queue.writeBuffer(buffers.colorBuffer, vertexStart * 16, colors)
  }

  updateTransform(t: TransformUniform) {
    const data = new Float32Array([
      t.scaleX,
      t.scaleY,
      t.translateX,
      t.translateY,
      t.viewportWidth,
      t.viewportHeight,
      0,
      0,
    ])
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data)
  }

  render(clearColor: [number, number, number, number]) {
    const textureView = this.context.getCurrentTexture().createView()
    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: {
            r: clearColor[0],
            g: clearColor[1],
            b: clearColor[2],
            a: clearColor[3],
          },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })

    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.uniformBindGroup)

    for (const buffers of [
      this.edgeBuffers,
      this.nodeBuffers,
      this.arrowBuffers,
    ]) {
      if (buffers && buffers.indexCount > 0) {
        pass.setVertexBuffer(0, buffers.positionBuffer)
        pass.setVertexBuffer(1, buffers.normalBuffer)
        pass.setVertexBuffer(2, buffers.thicknessBuffer)
        pass.setVertexBuffer(3, buffers.colorBuffer)
        pass.setIndexBuffer(buffers.indexBuffer, 'uint32')
        pass.drawIndexed(buffers.indexCount)
      }
    }

    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  destroy() {
    if (this.edgeBuffers) {
      this.destroySubBatchBuffers(this.edgeBuffers)
    }
    if (this.nodeBuffers) {
      this.destroySubBatchBuffers(this.nodeBuffers)
    }
    if (this.arrowBuffers) {
      this.destroySubBatchBuffers(this.arrowBuffers)
    }
    this.uniformBuffer.destroy()
    this.edgeBuffers = null
    this.nodeBuffers = null
    this.arrowBuffers = null
  }
}
