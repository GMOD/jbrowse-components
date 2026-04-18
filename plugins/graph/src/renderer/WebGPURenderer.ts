/// <reference types="@webgpu/types" />

import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'
import { glToGpuVertexFormat } from '@jbrowse/core/gpu/webgpuUtils'

import * as graphShader from './shaders/graph.generated.ts'
import { SUB_BATCH_KEYS } from './types.ts'

import type {
  RenderBatch,
  Renderer,
  SubBatch,
  SubBatchKey,
  TransformUniform,
} from './types.ts'

const U = graphShader.UNIFORM_OFFSET_F32
const STRIDE_BYTES = graphShader.INSTANCE_STRIDE_BYTES
const COLOR_OFFSET_BYTES = graphShader.FIELD_OFFSET_BYTES.color

interface SubBatchBuffers {
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  indexCount: number
}

export class WebGPURenderer implements Renderer {
  private device: GPUDevice
  private context: GPUCanvasContext
  private pipeline: GPURenderPipeline
  private uniformBuffer: GPUBuffer
  private uniformBindGroup: GPUBindGroup
  private uniformData = new ArrayBuffer(graphShader.UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)
  private subBatches: Record<SubBatchKey, SubBatchBuffers | null> = {
    edges: null,
    nodes: null,
    arrows: null,
  }

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
    const module = device.createShaderModule({ code: graphShader.WGSL_SOURCE })

    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: STRIDE_BYTES,
            attributes: graphShader.GL_ATTRIBUTES.map((a, i) => ({
              shaderLocation: i,
              offset: a.offsetBytes,
              format: glToGpuVertexFormat(a),
            })),
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
      size: graphShader.UNIFORMS_SIZE_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const uniformBindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 1, resource: { buffer: uniformBuffer } }],
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
      vertexBuffer: this.createBuffer(batch.vertexData, GPUBufferUsage.VERTEX),
      indexBuffer: this.createBuffer(batch.indices, GPUBufferUsage.INDEX),
      indexCount: batch.indices.length,
    }
  }

  private destroySubBatchBuffers(buffers: SubBatchBuffers) {
    buffers.vertexBuffer.destroy()
    buffers.indexBuffer.destroy()
  }

  uploadGeometry(batch: RenderBatch) {
    for (const key of SUB_BATCH_KEYS) {
      const existing = this.subBatches[key]
      if (existing) {
        this.destroySubBatchBuffers(existing)
      }
      this.subBatches[key] =
        batch[key].indices.length > 0
          ? this.createSubBatchBuffers(batch[key])
          : null
    }
  }

  updateSubBatchColors(
    target: SubBatchKey,
    colors: Uint32Array,
    vertexStart: number,
  ) {
    const buffers = this.subBatches[target]
    if (!buffers) {
      return
    }
    for (let i = 0; i < colors.length; i++) {
      this.device.queue.writeBuffer(
        buffers.vertexBuffer,
        (vertexStart + i) * STRIDE_BYTES + COLOR_OFFSET_BYTES,
        colors.buffer,
        colors.byteOffset + i * 4,
        4,
      )
    }
  }

  updateTransform(t: TransformUniform) {
    const f32 = this.uniformF32
    f32[U.scale] = t.scaleX
    f32[U.scale + 1] = t.scaleY
    f32[U.translate] = t.translateX
    f32[U.translate + 1] = t.translateY
    f32[U.viewport] = t.viewportWidth
    f32[U.viewport + 1] = t.viewportHeight
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData)
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

    for (const key of SUB_BATCH_KEYS) {
      const buffers = this.subBatches[key]
      if (buffers && buffers.indexCount > 0) {
        pass.setVertexBuffer(0, buffers.vertexBuffer)
        pass.setIndexBuffer(buffers.indexBuffer, 'uint32')
        pass.drawIndexed(buffers.indexCount)
      }
    }

    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  destroy() {
    for (const key of SUB_BATCH_KEYS) {
      const buffers = this.subBatches[key]
      if (buffers) {
        this.destroySubBatchBuffers(buffers)
        this.subBatches[key] = null
      }
    }
    this.uniformBuffer.destroy()
  }
}
