/// <reference types="@webgpu/types" />

import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'

import {
  disposeGL,
  initGL,
  render as renderGL,
  uploadGeometry as uploadGeometryGL,
} from './drawSequenceWebGL.ts'

import type { GLHandles } from './drawSequenceWebGL.ts'

const RECT_SHADER = /* wgsl */ `
struct RectInstance {
  x_bp: f32,
  y_px: f32,
  width_bp: f32,
  height_px: f32,
  color_r: f32,
  color_g: f32,
  color_b: f32,
  border_flag: f32,
}

struct Uniforms {
  offset_px: f32,
  bp_per_px: f32,
  canvas_width: f32,
  canvas_height: f32,
  border_width: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<RectInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
  @location(1) uv: vec2f,
  @location(2) rect_size_px: vec2f,
  @location(3) border_flag: f32,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  let inst = instances[iid];
  let v = vid % 6u;
  let cx = select(0.0, 1.0, v == 1u || v == 4u || v == 5u);
  let cy = select(0.0, 1.0, v == 2u || v == 3u || v == 5u);

  let x_bp = inst.x_bp + cx * inst.width_bp;
  let x_px = x_bp / u.bp_per_px - u.offset_px;
  let y_px = inst.y_px + cy * inst.height_px;

  let clip_x = (x_px / u.canvas_width) * 2.0 - 1.0;
  let clip_y = 1.0 - (y_px / u.canvas_height) * 2.0;

  var out: VertexOutput;
  out.position = vec4f(clip_x, clip_y, 0.0, 1.0);
  out.color = vec3f(inst.color_r, inst.color_g, inst.color_b);
  out.uv = vec2f(cx, cy);
  out.rect_size_px = vec2f(inst.width_bp / u.bp_per_px, inst.height_px);
  out.border_flag = inst.border_flag;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  var color = vec4f(in.color, 1.0);

  if u.border_width > 0.0 && in.border_flag > 0.5 {
    let edge_x = min(in.uv.x * in.rect_size_px.x, (1.0 - in.uv.x) * in.rect_size_px.x);
    let edge_y = min(in.uv.y * in.rect_size_px.y, (1.0 - in.uv.y) * in.rect_size_px.y);
    let edge = min(edge_x, edge_y);
    if edge < u.border_width {
      color = vec4f(0.333, 0.333, 0.333, 1.0);
    }
  }

  return color;
}
`

const INSTANCE_STRIDE = 8
const UNIFORM_SIZE = 32

const rendererCache = new WeakMap<HTMLCanvasElement, WebGPUSequenceRenderer>()

export class WebGPUSequenceRenderer {
  private static device: GPUDevice | null = null
  private static rectPipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null

  private canvas: HTMLCanvasElement
  private gpuContext: GPUCanvasContext | null = null
  private uniformBuffer: GPUBuffer | null = null
  private instanceBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)

  private glContext: WebGL2RenderingContext | null = null
  private glHandles: GLHandles | null = null
  private useWebGL = false

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new WebGPUSequenceRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  private static async ensureDevice() {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    if (WebGPUSequenceRenderer.device !== device) {
      WebGPUSequenceRenderer.device = device
      WebGPUSequenceRenderer.initPipelines(device)
    }
    return device
  }

  private static initPipelines(device: GPUDevice) {
    WebGPUSequenceRenderer.bindGroupLayout = device.createBindGroupLayout({
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

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [WebGPUSequenceRenderer.bindGroupLayout],
    })

    const module = device.createShaderModule({ code: RECT_SHADER })
    WebGPUSequenceRenderer.rectPipeline = device.createRenderPipeline({
      layout,
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{ format: 'bgra8unorm' }],
      },
      primitive: { topology: 'triangle-list' },
    })
  }

  async init() {
    const device = await WebGPUSequenceRenderer.ensureDevice()
    if (!device) {
      const gl = this.canvas.getContext('webgl2')
      if (!gl) {
        return false
      }
      this.glContext = gl
      this.glHandles = initGL(gl)
      this.useWebGL = true
      return true
    }

    this.gpuContext = this.canvas.getContext('webgpu')!
    this.gpuContext.configure({
      device,
      format: 'bgra8unorm',
      alphaMode: 'opaque',
    })

    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    return true
  }

  uploadGeometry(
    rectBuf: Float32Array,
    colorBuf: Uint8Array,
    instanceCount: number,
  ) {
    if (this.useWebGL) {
      if (this.glContext && this.glHandles) {
        uploadGeometryGL(this.glContext, this.glHandles, rectBuf, colorBuf)
      }
      return
    }

    const device = WebGPUSequenceRenderer.device
    if (
      !device ||
      !WebGPUSequenceRenderer.bindGroupLayout ||
      !this.uniformBuffer
    ) {
      return
    }

    this.instanceBuffer?.destroy()
    this.instanceBuffer = null
    this.bindGroup = null

    if (instanceCount === 0) {
      return
    }

    const interleaved = new Float32Array(instanceCount * INSTANCE_STRIDE)
    for (let i = 0; i < instanceCount; i++) {
      const ri = i * 4
      const off = i * INSTANCE_STRIDE
      interleaved[off] = rectBuf[ri]!
      interleaved[off + 1] = rectBuf[ri + 1]!
      interleaved[off + 2] = rectBuf[ri + 2]!
      interleaved[off + 3] = rectBuf[ri + 3]!
      interleaved[off + 4] = colorBuf[ri]! / 255
      interleaved[off + 5] = colorBuf[ri + 1]! / 255
      interleaved[off + 6] = colorBuf[ri + 2]! / 255
      interleaved[off + 7] = colorBuf[ri + 3]! > 254 ? 1 : 0
    }

    this.instanceBuffer = device.createBuffer({
      size: interleaved.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(this.instanceBuffer, 0, interleaved)

    this.bindGroup = device.createBindGroup({
      layout: WebGPUSequenceRenderer.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.instanceBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    })
  }

  render(
    instanceCount: number,
    offsetPx: number,
    bpPerPx: number,
    cssWidth: number,
    cssHeight: number,
  ) {
    if (this.useWebGL) {
      if (this.glContext && this.glHandles) {
        renderGL(
          this.glContext,
          this.glHandles,
          instanceCount,
          offsetPx,
          bpPerPx,
          cssWidth,
          cssHeight,
        )
      }
      return
    }

    const device = WebGPUSequenceRenderer.device
    if (!device || !WebGPUSequenceRenderer.rectPipeline || !this.gpuContext) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    const w = Math.round(cssWidth * dpr)
    const h = Math.round(cssHeight * dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
      this.gpuContext.configure({
        device,
        format: 'bgra8unorm',
        alphaMode: 'opaque',
      })
    }

    const borderWidth = 1 / bpPerPx >= 12 ? 1 : 0

    this.uniformF32[0] = offsetPx
    this.uniformF32[1] = bpPerPx
    this.uniformF32[2] = cssWidth
    this.uniformF32[3] = cssHeight
    this.uniformF32[4] = borderWidth
    this.uniformF32[5] = 0
    this.uniformF32[6] = 0
    this.uniformF32[7] = 0
    device.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData)

    const textureView = this.gpuContext.getCurrentTexture().createView()
    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'clear' as GPULoadOp,
          storeOp: 'store' as GPUStoreOp,
          clearValue: { r: 1, g: 1, b: 1, a: 1 },
        },
      ],
    })

    if (this.bindGroup && instanceCount > 0) {
      pass.setPipeline(WebGPUSequenceRenderer.rectPipeline)
      pass.setBindGroup(0, this.bindGroup)
      pass.draw(6, instanceCount)
    }

    pass.end()
    device.queue.submit([encoder.finish()])
  }

  dispose() {
    if (this.useWebGL) {
      if (this.glContext && this.glHandles) {
        disposeGL(this.glContext, this.glHandles)
      }
      this.glContext = null
      this.glHandles = null
      return
    }

    this.instanceBuffer?.destroy()
    this.instanceBuffer = null
    this.bindGroup = null
    this.uniformBuffer?.destroy()
    this.uniformBuffer = null
    this.gpuContext = null
    rendererCache.delete(this.canvas)
  }
}
