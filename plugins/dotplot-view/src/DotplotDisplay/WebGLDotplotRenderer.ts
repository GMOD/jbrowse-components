import { createProgram as createGLProgram } from '@jbrowse/core/gpu/webglUtils'

import { VERTS_PER_INSTANCE } from './dotplotShaders.ts'

import type {
  DotplotBackend,
  DotplotGeometryData,
} from './dotplotBackendTypes.ts'

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

export class WebGLDotplotRenderer implements DotplotBackend {
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

    const templateData = new Float32Array([
      0, -1, 0, 1, 1, -1, 1, -1, 0, 1, 1, 1,
    ])
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

  uploadGeometry(data: DotplotGeometryData) {
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
      const buf = gl.createBuffer()
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

    const vao = gl.createVertexArray()
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
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        VERTS_PER_INSTANCE,
        this.instanceCount,
      )
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
