/// <reference types="@webgpu/types" />

import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'

import {
  INSTANCE_BYTE_SIZE,
  VERTS_PER_INSTANCE,
  dotplotShader,
} from './dotplotShaders.ts'

const UNIFORM_SIZE = 32

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

const rendererCache = new WeakMap<HTMLCanvasElement, DotplotRenderer>()

export class DotplotRenderer {
  private static device: GPUDevice | null = null
  private static pipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null

  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext | null = null
  private uniformBuffer: GPUBuffer | null = null
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private instanceBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private instanceCount = 0

  private glFallback: WebGLFallback | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new DotplotRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  private static async ensureDevice() {
    if (DotplotRenderer.device) {
      return DotplotRenderer.device
    }
    const device = await getGpuDevice()
    if (device && !DotplotRenderer.device) {
      DotplotRenderer.device = device
      DotplotRenderer.initPipelines(device)
    }
    return device
  }

  private static initPipelines(device: GPUDevice) {
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

    DotplotRenderer.bindGroupLayout = device.createBindGroupLayout({
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
      bindGroupLayouts: [DotplotRenderer.bindGroupLayout],
    })

    const module = device.createShaderModule({ code: dotplotShader })
    DotplotRenderer.pipeline = device.createRenderPipeline({
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

  async init() {
    const device = await DotplotRenderer.ensureDevice()
    if (!device) {
      try {
        this.glFallback = new WebGLFallback(this.canvas)
        return true
      } catch {
        return false
      }
    }

    this.context = this.canvas.getContext('webgpu')!
    this.context.configure({
      device,
      format: 'bgra8unorm',
      alphaMode: 'premultiplied',
    })

    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    return true
  }

  resize(width: number, height: number) {
    if (this.glFallback) {
      this.glFallback.resize(width, height)
      return
    }
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw
      this.canvas.height = ph
    }
  }

  uploadGeometry(data: {
    x1s: Float32Array
    y1s: Float32Array
    x2s: Float32Array
    y2s: Float32Array
    colors: Float32Array
    instanceCount: number
  }) {
    if (this.glFallback) {
      this.glFallback.uploadGeometry(data)
      return
    }

    const device = DotplotRenderer.device
    if (!device || !DotplotRenderer.bindGroupLayout || !this.uniformBuffer) {
      return
    }

    this.instanceBuffer?.destroy()
    this.instanceCount = data.instanceCount

    if (data.instanceCount === 0) {
      this.instanceBuffer = null
      this.bindGroup = null
      return
    }

    const n = data.instanceCount
    const buf = new ArrayBuffer(n * INSTANCE_BYTE_SIZE)
    const f = new Float32Array(buf)
    const stride = INSTANCE_BYTE_SIZE / 4

    for (let i = 0; i < n; i++) {
      const off = i * stride
      f[off] = data.x1s[i]!
      f[off + 1] = data.y1s[i]!
      f[off + 2] = data.x2s[i]!
      f[off + 3] = data.y2s[i]!
      f[off + 4] = data.colors[i * 4]!
      f[off + 5] = data.colors[i * 4 + 1]!
      f[off + 6] = data.colors[i * 4 + 2]!
      f[off + 7] = data.colors[i * 4 + 3]!
    }

    this.instanceBuffer = device.createBuffer({
      size: buf.byteLength || 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(this.instanceBuffer, 0, buf)

    this.bindGroup = device.createBindGroup({
      layout: DotplotRenderer.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.instanceBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    })
  }

  render(
    offsetX: number,
    offsetY: number,
    lineWidth: number,
    scaleX: number,
    scaleY: number,
  ) {
    if (this.glFallback) {
      this.glFallback.render(offsetX, offsetY, lineWidth, scaleX, scaleY)
      return
    }

    const device = DotplotRenderer.device
    if (!device || !DotplotRenderer.pipeline || !this.context) {
      return
    }
    if (!this.instanceBuffer || !this.bindGroup || this.instanceCount === 0) {
      this.clearCanvas(device)
      return
    }

    const w = this.canvas.width
    const h = this.canvas.height
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    const logicalW = w / dpr
    const logicalH = h / dpr

    this.uniformF32[0] = logicalW
    this.uniformF32[1] = logicalH
    this.uniformF32[2] = offsetX
    this.uniformF32[3] = offsetY
    this.uniformF32[4] = lineWidth
    this.uniformF32[5] = scaleX
    this.uniformF32[6] = scaleY
    this.uniformF32[7] = 0
    device.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData)

    const textureView = this.context.getCurrentTexture().createView()
    const encoder = device.createCommandEncoder()
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
    pass.setPipeline(DotplotRenderer.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.draw(VERTS_PER_INSTANCE, this.instanceCount)
    pass.end()
    device.queue.submit([encoder.finish()])
  }

  dispose() {
    if (this.glFallback) {
      this.glFallback.dispose()
      this.glFallback = null
      return
    }
    this.instanceBuffer?.destroy()
    this.instanceBuffer = null
    this.bindGroup = null
    this.uniformBuffer?.destroy()
    this.uniformBuffer = null
    this.context = null
  }

  private clearCanvas(device: GPUDevice) {
    if (!this.context) {
      return
    }
    const textureView = this.context.getCurrentTexture().createView()
    const encoder = device.createCommandEncoder()
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
    device.queue.submit([encoder.finish()])
  }
}

class WebGLFallback {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject | null = null
  private templateBuffer: WebGLBuffer
  private allocatedBuffers: WebGLBuffer[] = []
  private instanceCount = 0
  private width = 0
  private height = 0
  private uniformLocs: Record<string, WebGLUniformLocation | null> = {}

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
    })
    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl
    this.program = createGLProgram(gl, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER)

    for (const name of UNIFORM_NAMES) {
      this.uniformLocs[name] = gl.getUniformLocation(this.program, name)
    }

    const templateData = new Float32Array([0, -1, 0, 1, 1, -1, 1, -1, 0, 1, 1, 1])
    this.templateBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, templateData, gl.STATIC_DRAW)

    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  resize(width: number, height: number) {
    if (this.width === width && this.height === height) {
      return
    }
    this.width = width
    this.height = height
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  uploadGeometry(data: {
    x1s: Float32Array
    y1s: Float32Array
    x2s: Float32Array
    y2s: Float32Array
    colors: Float32Array
    instanceCount: number
  }) {
    const { gl } = this

    if (this.vao) {
      gl.deleteVertexArray(this.vao)
      this.vao = null
    }
    for (const buf of this.allocatedBuffers) {
      gl.deleteBuffer(buf)
    }
    this.allocatedBuffers = []
    this.instanceCount = data.instanceCount

    if (data.instanceCount === 0) {
      return
    }

    const createBuf = (arr: Float32Array) => {
      const buf = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW)
      this.allocatedBuffers.push(buf)
      return buf
    }

    const x1Buf = createBuf(data.x1s)
    const y1Buf = createBuf(data.y1s)
    const x2Buf = createBuf(data.x2s)
    const y2Buf = createBuf(data.y2s)
    const colorBuf = createBuf(data.colors)

    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)

    const stride = 2 * 4
    const tLoc = gl.getAttribLocation(this.program, 'a_t')
    gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
    gl.enableVertexAttribArray(tLoc)
    gl.vertexAttribPointer(tLoc, 1, gl.FLOAT, false, stride, 0)

    const sideLoc = gl.getAttribLocation(this.program, 'a_side')
    gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
    gl.enableVertexAttribArray(sideLoc)
    gl.vertexAttribPointer(sideLoc, 1, gl.FLOAT, false, stride, 4)

    const instanceAttrs: [string, WebGLBuffer][] = [
      ['a_x1', x1Buf],
      ['a_y1', y1Buf],
      ['a_x2', x2Buf],
      ['a_y2', y2Buf],
    ]
    for (const [name, buf] of instanceAttrs) {
      const loc = gl.getAttribLocation(this.program, name)
      if (loc >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0)
        gl.vertexAttribDivisor(loc, 1)
      }
    }

    const colorLoc = gl.getAttribLocation(this.program, 'a_color')
    if (colorLoc >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf)
      gl.enableVertexAttribArray(colorLoc)
      gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(colorLoc, 1)
    }

    gl.bindVertexArray(null)
    this.vao = vao
  }

  render(
    offsetX: number,
    offsetY: number,
    lineWidth: number,
    scaleX: number,
    scaleY: number,
  ) {
    const { gl } = this
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (this.vao && this.instanceCount > 0) {
      gl.useProgram(this.program)
      gl.bindVertexArray(this.vao)
      gl.uniform2f(this.uniformLocs.u_resolution!, this.width, this.height)
      gl.uniform1f(this.uniformLocs.u_offsetX!, offsetX)
      gl.uniform1f(this.uniformLocs.u_offsetY!, offsetY)
      gl.uniform1f(this.uniformLocs.u_lineWidth!, lineWidth)
      gl.uniform1f(this.uniformLocs.u_scaleX!, scaleX)
      gl.uniform1f(this.uniformLocs.u_scaleY!, scaleY)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, VERTS_PER_INSTANCE, this.instanceCount)
      gl.bindVertexArray(null)
    }
  }

  dispose() {
    const { gl } = this
    if (this.vao) {
      gl.deleteVertexArray(this.vao)
    }
    for (const buf of this.allocatedBuffers) {
      gl.deleteBuffer(buf)
    }
    gl.deleteProgram(this.program)
    gl.deleteBuffer(this.templateBuffer)
  }
}
