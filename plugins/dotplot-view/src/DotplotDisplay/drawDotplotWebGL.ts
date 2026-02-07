import type { DotplotFeatPos } from './types.ts'

const LINE_VERTEX_SHADER = `#version 300 es
precision highp float;

// per-vertex template attributes
in float a_t;
in float a_side;

// per-instance attributes
in float a_x1;
in float a_y1;
in float a_x2;
in float a_y2;
in vec4 a_color;

uniform vec2 u_resolution;
uniform float u_offsetX;
uniform float u_offsetY;
uniform float u_lineWidth;

out vec4 v_color;
out float v_dist;

void main() {
  // Apply scroll offsets to get viewport-relative positions
  float sx1 = a_x1 - u_offsetX;
  float sy1 = u_resolution.y - (a_y1 - u_offsetY);
  float sx2 = a_x2 - u_offsetX;
  float sy2 = u_resolution.y - (a_y2 - u_offsetY);

  // Interpolate along the line
  float x = mix(sx1, sx2, a_t);
  float y = mix(sy1, sy2, a_t);

  // Compute perpendicular for ribbon extrusion
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
  const program = gl.createProgram()
  if (!program) {
    throw new Error('Failed to create program')
  }
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

// 6 vertices per line instance (2 triangles forming a quad)
// a_t goes 0->1 along the line, a_side is -1 or +1 for extrusion
const VERTICES_PER_INSTANCE = 6

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

      // Cache uniform locations
      const uniformNames = [
        'u_resolution',
        'u_offsetX',
        'u_offsetY',
        'u_lineWidth',
      ]
      for (const name of uniformNames) {
        this.uniformLocs[name] = gl.getUniformLocation(this.program, name)
      }

      // Template buffer: 6 vertices forming a quad (2 triangles)
      // Each vertex has (t, side)
      const templateData = new Float32Array([
        // Triangle 1: start-left, start-right, end-left
        0, -1, 0, 1, 1, -1,
        // Triangle 2: end-left, start-right, end-right
        1, -1, 0, 1, 1, 1,
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
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    this.allocatedBuffers.push(buf)
    return buf
  }

  buildGeometry(
    featPositions: DotplotFeatPos[],
    colorFn: (f: DotplotFeatPos, index: number) => [number, number, number, number],
    drawCigar: boolean,
    hBpPerPx: number,
    vBpPerPx: number,
  ) {
    if (!this.gl) {
      return
    }
    const gl = this.gl
    this.cleanupGeometry()

    const x1s: number[] = []
    const y1s: number[] = []
    const x2s: number[] = []
    const y2s: number[] = []
    const colors: number[] = []

    for (let i = 0; i < featPositions.length; i++) {
      const feat = featPositions[i]!
      const { p11, p12, p21, p22, cigar } = feat

      if (cigar.length > 0 && drawCigar) {
        // Decompose CIGAR into segments
        const strand = feat.f.get('strand') as number || 1
        const hStart = p11.offsetPx
        const hEnd = p12.offsetPx
        const vStart = p21.offsetPx
        const vEnd = p22.offsetPx

        const hRange = hEnd - hStart
        const vRange = vEnd - vStart

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

        let cx = hStart
        let cy = vStart
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

          if (
            Math.abs(cx - segStartX) > 0.5 ||
            Math.abs(cy - segStartY) > 0.5
          ) {
            const [cr, cg, cb, ca] = colorFn(feat, i)
            x1s.push(segStartX)
            y1s.push(segStartY)
            x2s.push(cx)
            y2s.push(cy)
            colors.push(cr, cg, cb, ca)
            segStartX = cx
            segStartY = cy
          }
        }
      } else {
        const [cr, cg, cb, ca] = colorFn(feat, i)
        x1s.push(p11.offsetPx)
        y1s.push(p21.offsetPx)
        x2s.push(p12.offsetPx)
        y2s.push(p22.offsetPx)
        colors.push(cr, cg, cb, ca)
      }
    }

    this.instanceCount = x1s.length
    if (this.instanceCount === 0) {
      return
    }

    const x1Buf = this.createBuffer(gl, new Float32Array(x1s))
    const y1Buf = this.createBuffer(gl, new Float32Array(y1s))
    const x2Buf = this.createBuffer(gl, new Float32Array(x2s))
    const y2Buf = this.createBuffer(gl, new Float32Array(y2s))
    const colorBuf = this.createBuffer(gl, new Float32Array(colors))

    // Build VAO
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)

    const program = this.program!
    const stride = 2 * 4

    // Per-vertex template attributes
    const tLoc = gl.getAttribLocation(program, 'a_t')
    gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
    gl.enableVertexAttribArray(tLoc)
    gl.vertexAttribPointer(tLoc, 1, gl.FLOAT, false, stride, 0)

    const sideLoc = gl.getAttribLocation(program, 'a_side')
    gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
    gl.enableVertexAttribArray(sideLoc)
    gl.vertexAttribPointer(sideLoc, 1, gl.FLOAT, false, stride, 4)

    // Per-instance attributes
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

    // Color is vec4 per instance
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

  render(offsetX: number, offsetY: number, lineWidth: number) {
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
