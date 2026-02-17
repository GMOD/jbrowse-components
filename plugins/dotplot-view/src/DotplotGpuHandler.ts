/// <reference types="@webgpu/types" />
import GpuHandlerType from '@jbrowse/core/pluggableElementTypes/GpuHandlerType'

import {
  INSTANCE_BYTE_SIZE,
  VERTS_PER_INSTANCE,
  dotplotShader,
} from './DotplotDisplay/dotplotShaders.ts'

import type { GpuCanvasContext } from '@jbrowse/core/pluggableElementTypes/GpuHandlerType'
import type PluginManager from '@jbrowse/core/PluginManager'

const UNIFORM_SIZE = 32

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
  instanceCount: number
  uniformData: ArrayBuffer
  uniformF32: Float32Array
}

interface WebGLCanvasState {
  canvas: OffscreenCanvas
  gl: WebGL2RenderingContext
  program: WebGLProgram
  vao: WebGLVertexArrayObject | null
  templateBuffer: WebGLBuffer
  allocatedBuffers: WebGLBuffer[]
  instanceCount: number
  width: number
  height: number
  logicalWidth: number
  logicalHeight: number
  dpr: number
  uniformLocs: Record<string, WebGLUniformLocation | null>
}

const LINE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_t;
in float a_side;

in float a_x1;
in float a_y1;
in float a_x2;
in float a_y2;
in vec4 a_color;

uniform vec2 u_resolution;
uniform float u_offsetX;
uniform float u_offsetY;
uniform float u_lineWidth;
uniform float u_scaleX;
uniform float u_scaleY;

out vec4 v_color;
out float v_dist;

void main() {
  float sx1 = a_x1 * u_scaleX - u_offsetX;
  float sy1 = u_resolution.y - (a_y1 * u_scaleY - u_offsetY);
  float sx2 = a_x2 * u_scaleX - u_offsetX;
  float sy2 = u_resolution.y - (a_y2 * u_scaleY - u_offsetY);

  float x = mix(sx1, sx2, a_t);
  float y = mix(sy1, sy2, a_t);

  vec2 dir = vec2(sx2 - sx1, sy2 - sy1);
  float len = length(dir);
  vec2 normal;
  if (len > 0.001) {
    dir /= len;
    normal = vec2(-dir.y, dir.x);
  } else {
    normal = vec2(0.0, 1.0);
  }

  vec2 pos = vec2(x, y) + normal * a_side * u_lineWidth * 0.5;
  vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  v_color = a_color;
  v_dist = a_side;
}
`

const LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
in float v_dist;

out vec4 fragColor;

void main() {
  float d = abs(v_dist);
  float aa = fwidth(v_dist);
  float edgeAlpha = 1.0 - smoothstep(0.5 - aa * 0.5, 0.5 + aa, d);
  float finalAlpha = v_color.a * edgeAlpha;
  fragColor = vec4(v_color.rgb * finalAlpha, finalAlpha);
}
`

const UNIFORM_NAMES = [
  'u_resolution',
  'u_offsetX',
  'u_offsetY',
  'u_lineWidth',
  'u_scaleX',
  'u_scaleY',
]

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error('Failed to create shader')
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info}`)
  }
  return shader
}

function createGLProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.detachShader(program, vs)
  gl.detachShader(program, fs)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${info}`)
  }
  return program
}

export default class DotplotGpuHandler extends GpuHandlerType {
  name = 'DotplotGpuHandler'

  private device: GPUDevice | null = null
  private pipeline: GPURenderPipeline | null = null
  private renderBindGroupLayout: GPUBindGroupLayout | null = null
  private canvases = new Map<number, CanvasState>()

  private useWebGL = false
  private webglCanvases = new Map<number, WebGLCanvasState>()

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

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [this.renderBindGroupLayout],
    })

    const blendState: GPUBlendState = {
      color: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
      alpha: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
    }

    const module = device.createShaderModule({ code: dotplotShader })
    this.pipeline = device.createRenderPipeline({
      layout,
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{ format: 'bgra8unorm', blend: blendState }],
      },
      primitive: { topology: 'triangle-list' },
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
      return
    }
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
    }
  }

  dispose(canvasId: number) {
    const state = this.canvases.get(canvasId)
    if (state) {
      state.instanceBuffer?.destroy()
      state.uniformBuffer?.destroy()
      this.canvases.delete(canvasId)
    }
    this.webglCanvases.delete(canvasId)
  }

  private ensureCanvas(canvasId: number, ctx: GpuCanvasContext) {
    let state = this.canvases.get(canvasId)
    if (!state && this.device) {
      const gpuContext = ctx.canvas.getContext('webgpu')!
      gpuContext.configure({
        device: this.device,
        format: 'bgra8unorm',
        alphaMode: 'premultiplied',
      })

      const uniformData = new ArrayBuffer(UNIFORM_SIZE)
      const uniformBuffer = this.device.createBuffer({
        size: UNIFORM_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
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
        instanceCount: 0,
        uniformData,
        uniformF32: new Float32Array(uniformData),
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
  }

  private handleUploadGeometry(state: CanvasState, msg: Record<string, unknown>) {
    if (!this.device) {
      return
    }
    state.instanceCount = msg.instanceCount as number

    const x1s = msg.x1s as Float32Array
    const y1s = msg.y1s as Float32Array
    const x2s = msg.x2s as Float32Array
    const y2s = msg.y2s as Float32Array
    const colors = msg.colors as Float32Array
    const n = state.instanceCount

    const buf = new ArrayBuffer(n * INSTANCE_BYTE_SIZE)
    const f = new Float32Array(buf)
    const stride = INSTANCE_BYTE_SIZE / 4

    for (let i = 0; i < n; i++) {
      const off = i * stride
      f[off] = x1s[i]!
      f[off + 1] = y1s[i]!
      f[off + 2] = x2s[i]!
      f[off + 3] = y2s[i]!
      f[off + 4] = colors[i * 4]!
      f[off + 5] = colors[i * 4 + 1]!
      f[off + 6] = colors[i * 4 + 2]!
      f[off + 7] = colors[i * 4 + 3]!
    }

    state.instanceBuffer?.destroy()
    state.instanceBuffer = this.device.createBuffer({
      size: buf.byteLength || 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(state.instanceBuffer, 0, buf)

    if (state.uniformBuffer) {
      state.renderBindGroup = this.device.createBindGroup({
        layout: this.renderBindGroupLayout!,
        entries: [
          { binding: 0, resource: { buffer: state.instanceBuffer } },
          { binding: 1, resource: { buffer: state.uniformBuffer } },
        ],
      })
    }
  }

  private handleRender(state: CanvasState, msg: Record<string, unknown>) {
    if (!this.device || !state.instanceBuffer || state.instanceCount === 0) {
      return
    }
    if (!state.renderBindGroup || !this.pipeline) {
      return
    }

    state.uniformF32[0] = state.logicalWidth
    state.uniformF32[1] = state.logicalHeight
    state.uniformF32[2] = msg.offsetX as number
    state.uniformF32[3] = msg.offsetY as number
    state.uniformF32[4] = msg.lineWidth as number
    state.uniformF32[5] = msg.scaleX as number
    state.uniformF32[6] = msg.scaleY as number
    state.uniformF32[7] = 0
    this.device.queue.writeBuffer(state.uniformBuffer!, 0, state.uniformData)

    const encoder = this.device.createCommandEncoder()
    const tv = state.context.getCurrentTexture().createView()

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: tv,
          loadOp: 'clear' as GPULoadOp,
          storeOp: 'store' as GPUStoreOp,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    })
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, state.renderBindGroup)
    pass.draw(VERTS_PER_INSTANCE, state.instanceCount)
    pass.end()

    this.device.queue.submit([encoder.finish()])
  }

  // --- WebGL2 fallback ---

  private handleWebGLMessage(
    msg: { type: string; canvasId: number; [key: string]: unknown },
    ctx: GpuCanvasContext,
  ) {
    switch (msg.type) {
      case 'resize': {
        const state = this.ensureWebGLCanvas(msg.canvasId, ctx)
        if (state) {
          this.handleWebGLResize(state, msg)
        }
        break
      }
      case 'upload-geometry': {
        const state = this.ensureWebGLCanvas(msg.canvasId, ctx)
        if (state) {
          this.handleWebGLUploadGeometry(state, msg)
        }
        break
      }
      case 'render': {
        const state = this.webglCanvases.get(msg.canvasId)
        if (state) {
          this.handleWebGLRender(state, msg)
        }
        break
      }
    }
  }

  private ensureWebGLCanvas(canvasId: number, ctx: GpuCanvasContext) {
    let state = this.webglCanvases.get(canvasId)
    if (state) {
      return state
    }

    const gl = ctx.canvas.getContext('webgl2', {
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
    }) as WebGL2RenderingContext | null
    if (!gl) {
      return undefined
    }

    const program = createGLProgram(gl, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER)

    const uniformLocs: Record<string, WebGLUniformLocation | null> = {}
    for (const name of UNIFORM_NAMES) {
      uniformLocs[name] = gl.getUniformLocation(program, name)
    }

    const templateData = new Float32Array([0, -1, 0, 1, 1, -1, 1, -1, 0, 1, 1, 1])
    const templateBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, templateBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, templateData, gl.STATIC_DRAW)

    gl.viewport(0, 0, ctx.canvas.width, ctx.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    state = {
      canvas: ctx.canvas,
      gl,
      program,
      vao: null,
      templateBuffer,
      allocatedBuffers: [],
      instanceCount: 0,
      width: ctx.canvas.width,
      height: ctx.canvas.height,
      logicalWidth: ctx.width,
      logicalHeight: ctx.height,
      dpr: 2,
      uniformLocs,
    }
    this.webglCanvases.set(canvasId, state)
    return state
  }

  private handleWebGLResize(state: WebGLCanvasState, msg: Record<string, unknown>) {
    state.logicalWidth = msg.width as number
    state.logicalHeight = msg.height as number
    state.dpr = (msg.dpr as number) ?? 2
    state.width = Math.round(state.logicalWidth * state.dpr)
    state.height = Math.round(state.logicalHeight * state.dpr)
    state.canvas.width = state.width
    state.canvas.height = state.height
    state.gl.viewport(0, 0, state.width, state.height)
  }

  private handleWebGLUploadGeometry(state: WebGLCanvasState, msg: Record<string, unknown>) {
    const { gl } = state

    if (state.vao) {
      gl.deleteVertexArray(state.vao)
      state.vao = null
    }
    for (const buf of state.allocatedBuffers) {
      gl.deleteBuffer(buf)
    }
    state.allocatedBuffers = []

    state.instanceCount = msg.instanceCount as number
    if (state.instanceCount === 0) {
      return
    }

    const x1s = msg.x1s as Float32Array
    const y1s = msg.y1s as Float32Array
    const x2s = msg.x2s as Float32Array
    const y2s = msg.y2s as Float32Array
    const colors = msg.colors as Float32Array

    const createBuf = (data: Float32Array) => {
      const buf = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      state.allocatedBuffers.push(buf)
      return buf
    }

    const x1Buf = createBuf(x1s)
    const y1Buf = createBuf(y1s)
    const x2Buf = createBuf(x2s)
    const y2Buf = createBuf(y2s)
    const colorBuf = createBuf(colors)

    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)

    const stride = 2 * 4
    const tLoc = gl.getAttribLocation(state.program, 'a_t')
    gl.bindBuffer(gl.ARRAY_BUFFER, state.templateBuffer)
    gl.enableVertexAttribArray(tLoc)
    gl.vertexAttribPointer(tLoc, 1, gl.FLOAT, false, stride, 0)

    const sideLoc = gl.getAttribLocation(state.program, 'a_side')
    gl.bindBuffer(gl.ARRAY_BUFFER, state.templateBuffer)
    gl.enableVertexAttribArray(sideLoc)
    gl.vertexAttribPointer(sideLoc, 1, gl.FLOAT, false, stride, 4)

    const instanceAttrs: [string, WebGLBuffer][] = [
      ['a_x1', x1Buf],
      ['a_y1', y1Buf],
      ['a_x2', x2Buf],
      ['a_y2', y2Buf],
    ]
    for (const [name, buf] of instanceAttrs) {
      const loc = gl.getAttribLocation(state.program, name)
      if (loc >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0)
        gl.vertexAttribDivisor(loc, 1)
      }
    }

    const colorLoc = gl.getAttribLocation(state.program, 'a_color')
    if (colorLoc >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf)
      gl.enableVertexAttribArray(colorLoc)
      gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(colorLoc, 1)
    }

    gl.bindVertexArray(null)
    state.vao = vao
  }

  private handleWebGLRender(state: WebGLCanvasState, msg: Record<string, unknown>) {
    const { gl } = state

    gl.clear(gl.COLOR_BUFFER_BIT)

    if (state.vao && state.instanceCount > 0) {
      gl.useProgram(state.program)
      gl.bindVertexArray(state.vao)

      gl.uniform2f(state.uniformLocs.u_resolution!, state.logicalWidth, state.logicalHeight)
      gl.uniform1f(state.uniformLocs.u_offsetX!, msg.offsetX as number)
      gl.uniform1f(state.uniformLocs.u_offsetY!, msg.offsetY as number)
      gl.uniform1f(state.uniformLocs.u_lineWidth!, msg.lineWidth as number)
      gl.uniform1f(state.uniformLocs.u_scaleX!, msg.scaleX as number)
      gl.uniform1f(state.uniformLocs.u_scaleY!, msg.scaleY as number)

      gl.drawArraysInstanced(gl.TRIANGLES, 0, VERTS_PER_INSTANCE, state.instanceCount)
      gl.bindVertexArray(null)
    }
  }
}
