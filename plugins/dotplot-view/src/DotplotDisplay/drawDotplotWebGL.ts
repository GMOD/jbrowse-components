import type { DotplotFeatPos } from './types.ts'

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
  // Scale geometry from reference zoom level to current zoom level,
  // then apply scroll offsets to get viewport-relative positions
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

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
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

function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
) {
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

interface LineSegments {
  x1s: number[]
  y1s: number[]
  x2s: number[]
  y2s: number[]
  colors: number[]
}

// Minimum pixel width for meaningful CIGAR decomposition
const MIN_CIGAR_PX_WIDTH = 4

type ColorFn = (
  f: DotplotFeatPos,
  index: number,
) => [number, number, number, number]

function decomposeCigar(
  feat: DotplotFeatPos,
  index: number,
  colorFn: ColorFn,
  hBpPerPx: number,
  vBpPerPx: number,
  out: LineSegments,
) {
  const { p11, p12, p21, p22, cigar } = feat
  const hRange = p12 - p11
  const vRange = p22 - p21

  let totalBpH = 0
  let totalBpV = 0
  for (let j = 0; j < cigar.length; j += 2) {
    const len = +cigar[j]!
    const op = cigar[j + 1]
    if (op === 'M' || op === '=' || op === 'X') {
      totalBpH += len
      totalBpV += len
    } else if (op === 'D' || op === 'N') {
      totalBpH += len
    } else if (op === 'I') {
      totalBpV += len
    }
  }

  const pxPerBpH = totalBpH > 0 ? Math.abs(hRange) / totalBpH : 1 / hBpPerPx
  const pxPerBpV = totalBpV > 0 ? Math.abs(vRange) / totalBpV : 1 / vBpPerPx
  const hDir = hRange >= 0 ? 1 : -1
  const vDir = vRange >= 0 ? 1 : -1

  let cx = p11
  let cy = p21
  let segStartX = cx
  let segStartY = cy

  for (let j = 0; j < cigar.length; j += 2) {
    const len = +cigar[j]!
    const op = cigar[j + 1]!

    if (op === 'M' || op === '=' || op === 'X') {
      cx += len * pxPerBpH * hDir
      cy += len * pxPerBpV * vDir
    } else if (op === 'D' || op === 'N') {
      cx += len * pxPerBpH * hDir
    } else if (op === 'I') {
      cy += len * pxPerBpV * vDir
    }

    if (Math.abs(cx - segStartX) > 0.5 || Math.abs(cy - segStartY) > 0.5) {
      const [cr, cg, cb, ca] = colorFn(feat, index)
      out.x1s.push(segStartX)
      out.y1s.push(segStartY)
      out.x2s.push(cx)
      out.y2s.push(cy)
      out.colors.push(cr, cg, cb, ca)
      segStartX = cx
      segStartY = cy
    }
  }
}

function ensureMinExtent(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lineLen = Math.sqrt(dx * dx + dy * dy)
  if (lineLen >= 1) {
    return { x1, y1, x2, y2 }
  }
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  if (lineLen > 0.001) {
    const scale = 0.5 / lineLen
    return {
      x1: mx - dx * scale,
      y1: my - dy * scale,
      x2: mx + dx * scale,
      y2: my + dy * scale,
    }
  }
  return { x1: mx - 0.5, y1: my, x2: mx + 0.5, y2: my }
}

const VERTICES_PER_INSTANCE = 6

const UNIFORM_NAMES = [
  'u_resolution',
  'u_offsetX',
  'u_offsetY',
  'u_lineWidth',
  'u_scaleX',
  'u_scaleY',
]

export class DotplotWebGLRenderer {
  private gl: WebGL2RenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private width = 0
  private height = 0

  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private instanceCount = 0

  private templateBuffer: WebGLBuffer | null = null
  private allocatedBuffers: WebGLBuffer[] = []

  private uniformLocs: Record<string, WebGLUniformLocation | null> = {}

  init(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
    })

    if (!gl) {
      console.warn('WebGL2 not supported')
      return false
    }

    this.canvas = canvas
    this.gl = gl
    this.width = canvas.clientWidth || canvas.width
    this.height = canvas.clientHeight || canvas.height

    try {
      this.program = createProgram(gl, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER)

      for (const name of UNIFORM_NAMES) {
        this.uniformLocs[name] = gl.getUniformLocation(this.program, name)
      }

      const templateData = new Float32Array([
        0, -1, 0, 1, 1, -1, 1, -1, 0, 1, 1, 1,
      ])
      this.templateBuffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, templateData, gl.STATIC_DRAW)

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

      return true
    } catch (e) {
      console.error('WebGL initialization failed:', e)
      return false
    }
  }

  resize(width: number, height: number) {
    if (!this.canvas || !this.gl) {
      return
    }
    if (this.width === width && this.height === height) {
      return
    }
    this.width = width
    this.height = height
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    this.canvas.width = width * dpr
    this.canvas.height = height * dpr
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  private cleanupGeometry() {
    const gl = this.gl
    if (!gl) {
      return
    }
    if (this.vao) {
      gl.deleteVertexArray(this.vao)
      this.vao = null
    }
    for (const buf of this.allocatedBuffers) {
      gl.deleteBuffer(buf)
    }
    this.allocatedBuffers = []
    this.instanceCount = 0
  }

  private createBuffer(gl: WebGL2RenderingContext, data: Float32Array) {
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    this.allocatedBuffers.push(buf)
    return buf
  }

  buildGeometry(
    featPositions: DotplotFeatPos[],
    colorFn: ColorFn,
    drawCigar: boolean,
    hBpPerPx: number,
    vBpPerPx: number,
  ) {
    if (!this.gl) {
      return
    }
    const gl = this.gl
    this.cleanupGeometry()

    const out: LineSegments = {
      x1s: [],
      y1s: [],
      x2s: [],
      y2s: [],
      colors: [],
    }

    for (const [i, featPosition] of featPositions.entries()) {
      const feat = featPosition
      const { p11, p12, p21, p22, cigar } = feat

      const featureWidth = Math.max(Math.abs(p12 - p11), Math.abs(p22 - p21))

      if (
        cigar.length >= 2 &&
        drawCigar &&
        featureWidth >= MIN_CIGAR_PX_WIDTH
      ) {
        decomposeCigar(feat, i, colorFn, hBpPerPx, vBpPerPx, out)
      } else {
        const [cr, cg, cb, ca] = colorFn(feat, i)
        const { x1, y1, x2, y2 } = ensureMinExtent(p11, p21, p12, p22)
        out.x1s.push(x1)
        out.y1s.push(y1)
        out.x2s.push(x2)
        out.y2s.push(y2)
        out.colors.push(cr, cg, cb, ca)
      }
    }

    this.instanceCount = out.x1s.length
    if (this.instanceCount === 0) {
      return
    }

    const x1Buf = this.createBuffer(gl, new Float32Array(out.x1s))
    const y1Buf = this.createBuffer(gl, new Float32Array(out.y1s))
    const x2Buf = this.createBuffer(gl, new Float32Array(out.x2s))
    const y2Buf = this.createBuffer(gl, new Float32Array(out.y2s))
    const colorBuf = this.createBuffer(gl, new Float32Array(out.colors))

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    const program = this.program!
    const stride = 2 * 4

    const tLoc = gl.getAttribLocation(program, 'a_t')
    gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
    gl.enableVertexAttribArray(tLoc)
    gl.vertexAttribPointer(tLoc, 1, gl.FLOAT, false, stride, 0)

    const sideLoc = gl.getAttribLocation(program, 'a_side')
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
      const loc = gl.getAttribLocation(program, name)
      if (loc >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0)
        gl.vertexAttribDivisor(loc, 1)
      }
    }

    const colorLoc = gl.getAttribLocation(program, 'a_color')
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
    scaleX = 1,
    scaleY = 1,
  ) {
    if (!this.gl || !this.canvas) {
      return
    }
    const gl = this.gl

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
        VERTICES_PER_INSTANCE,
        this.instanceCount,
      )
      gl.bindVertexArray(null)
    }
  }

  dispose() {
    const gl = this.gl
    if (!gl) {
      return
    }
    this.cleanupGeometry()
    if (this.program) {
      gl.deleteProgram(this.program)
    }
    if (this.templateBuffer) {
      gl.deleteBuffer(this.templateBuffer)
    }
    this.gl = null
    this.canvas = null
  }
}
