import { colord } from '@jbrowse/core/util/colord'

import type { FeatPos } from './types.ts'

const EDGE_CURVE_SEGMENTS = 8

function cssColorToNormalized(color: string): [number, number, number, number] {
  const { r, g, b, a } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255, a]
}

// Vertex shader for dotplot - simple straight lines with instanced rendering
const VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-vertex (from template buffer)
in float a_t;     // 0.0 to 1.0 parameter along the line
in float a_side;  // -1.0 or +1.0 for ribbon sides

// Per-instance attributes
in float a_x1;        // Start X in offsetPx
in float a_x2;        // End X in offsetPx
in float a_y1;        // Start Y in offsetPx
in float a_y2;        // End Y in offsetPx
in vec4 a_color;      // RGBA color (normalized 0-1)
in float a_featureId; // Feature ID for picking

// Uniforms
uniform vec2 u_resolution;
uniform float u_offsetX;
uniform float u_offsetY;
uniform float u_visibleLeft;
uniform float u_visibleRight;

// Outputs
out vec4 v_color;
out float v_dist;
flat out float v_featureId;

void main() {
  // Viewport culling
  float screenMinX = min(a_x1, a_x2) - u_offsetX;
  float screenMaxX = max(a_x1, a_x2) - u_offsetX;
  if (screenMaxX < u_visibleLeft || screenMinX > u_visibleRight) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_color = vec4(0.0);
    v_dist = 0.0;
    v_featureId = 0.0;
    return;
  }

  // Linear interpolation along the line
  float x = mix(a_x1, a_x2, a_t) - u_offsetX;
  float y = mix(a_y1, a_y2, a_t) - u_offsetY;

  // Compute tangent for ribbon extrusion
  float eps = 1.0 / float(${EDGE_CURVE_SEGMENTS});
  float t0 = max(a_t - eps * 0.5, 0.0);
  float t1 = min(a_t + eps * 0.5, 1.0);
  vec2 p0 = vec2(mix(a_x1, a_x2, t0) - u_offsetX, mix(a_y1, a_y2, t0) - u_offsetY);
  vec2 p1 = vec2(mix(a_x1, a_x2, t1) - u_offsetX, mix(a_y1, a_y2, t1) - u_offsetY);
  vec2 tangent = p1 - p0;
  float tangentLen = length(tangent);

  vec2 normal;
  if (tangentLen > 0.001) {
    tangent /= tangentLen;
    normal = vec2(-tangent.y, tangent.x);
  } else {
    normal = vec2(0.0, 1.0);
  }

  // Extrude outward for AA
  float halfWidth = 0.5 + 0.5;
  vec2 extruded = vec2(x, y) + normal * halfWidth * a_side;

  // Convert to clip space
  vec2 clipSpace = (extruded / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);

  v_dist = a_side * halfWidth;
  v_color = a_color;
  v_featureId = a_featureId;
}
`

// Fragment shader with AA
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
in float v_dist;

out vec4 fragColor;

void main() {
  float halfWidth = 0.5;
  float d = abs(v_dist);
  float aa = fwidth(v_dist);
  float edgeAlpha = 1.0 - smoothstep(halfWidth - aa * 0.5, halfWidth + aa, d);
  float finalAlpha = v_color.a * edgeAlpha;
  fragColor = vec4(v_color.rgb * finalAlpha, finalAlpha);
}
`

// Picking fragment shader
const PICKING_FRAGMENT_SHADER = `#version 300 es
precision highp float;

flat in float v_featureId;

out vec4 outColor;

void main() {
  float id = v_featureId;
  float r = mod(id, 256.0) / 255.0;
  float g = mod(floor(id / 256.0), 256.0) / 255.0;
  float b = mod(floor(id / 65536.0), 256.0) / 255.0;
  outColor = vec4(r, g, b, 1.0);
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

export class DotplotWebGLRenderer {
  private gl: WebGL2RenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private width = 0
  private height = 0
  private devicePixelRatio = 1

  private program: WebGLProgram | null = null
  private pickingProgram: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private pickingVao: WebGLVertexArrayObject | null = null
  private instanceCount = 0
  private templateBuffer: WebGLBuffer | null = null

  private pickingFramebuffer: WebGLFramebuffer | null = null
  private pickingTexture: WebGLTexture | null = null
  private pickingDirty = true
  private lastOffsetX = 0
  private lastOffsetY = 0

  private uniformCache = new Map<WebGLProgram, Record<string, WebGLUniformLocation | null>>()
  private allocatedBuffers: WebGLBuffer[] = []

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
    this.devicePixelRatio = canvas.width / (canvas.clientWidth || canvas.width)
    this.width = canvas.clientWidth || canvas.width
    this.height = canvas.clientHeight || canvas.height

    try {
      this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)
      this.pickingProgram = createProgram(gl, VERTEX_SHADER, PICKING_FRAGMENT_SHADER)

      const uniformNames = ['u_resolution', 'u_offsetX', 'u_offsetY', 'u_visibleLeft', 'u_visibleRight']
      for (const prog of [this.program, this.pickingProgram]) {
        const locs: Record<string, WebGLUniformLocation | null> = {}
        for (const name of uniformNames) {
          locs[name] = gl.getUniformLocation(prog, name)
        }
        this.uniformCache.set(prog, locs)
      }

      // Template buffer: t and side for ribbon vertices
      const numVertices = (EDGE_CURVE_SEGMENTS + 1) * 2
      const templateData = new Float32Array(numVertices * 2)
      for (let i = 0; i <= EDGE_CURVE_SEGMENTS; i++) {
        const t = i / EDGE_CURVE_SEGMENTS
        const base = i * 4
        templateData[base + 0] = t
        templateData[base + 1] = 1
        templateData[base + 2] = t
        templateData[base + 3] = -1
      }
      this.templateBuffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, templateData, gl.STATIC_DRAW)

      // Picking framebuffer
      this.pickingFramebuffer = gl.createFramebuffer()!
      this.pickingTexture = gl.createTexture()!
      this.resizePickingBuffer(canvas.width, canvas.height)

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

  private resizePickingBuffer(canvasWidth: number, canvasHeight: number) {
    const gl = this.gl!
    gl.bindTexture(gl.TEXTURE_2D, this.pickingTexture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      canvasWidth,
      canvasHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFramebuffer)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.pickingTexture,
      0,
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  resize(width: number, height: number) {
    if (!this.canvas || !this.gl) {
      return
    }
    if (this.width === width && this.height === height) {
      return
    }
    const gl = this.gl
    this.devicePixelRatio = this.canvas.width / width
    this.width = width
    this.height = height
    this.resizePickingBuffer(this.canvas.width, this.canvas.height)

    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
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
    if (this.pickingVao) {
      gl.deleteVertexArray(this.pickingVao)
      this.pickingVao = null
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

  private setupVao(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    x1Buf: WebGLBuffer,
    x2Buf: WebGLBuffer,
    y1Buf: WebGLBuffer,
    y2Buf: WebGLBuffer,
    colorBuf: WebGLBuffer,
    featureIdBuf: WebGLBuffer,
  ) {
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)

    // Template buffer (t, side)
    const stride = 2 * 4
    const tLoc = gl.getAttribLocation(program, 'a_t')
    gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
    gl.enableVertexAttribArray(tLoc)
    gl.vertexAttribPointer(tLoc, 1, gl.FLOAT, false, stride, 0)

    const sideLoc = gl.getAttribLocation(program, 'a_side')
    gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
    gl.enableVertexAttribArray(sideLoc)
    gl.vertexAttribPointer(sideLoc, 1, gl.FLOAT, false, stride, 4)

    // Per-instance attributes
    const attrs: [string, WebGLBuffer][] = [
      ['a_x1', x1Buf],
      ['a_x2', x2Buf],
      ['a_y1', y1Buf],
      ['a_y2', y2Buf],
      ['a_featureId', featureIdBuf],
    ]
    for (const [name, buf] of attrs) {
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
    return vao
  }

  buildGeometry(
    features: FeatPos[],
    colorFn: (f: FeatPos) => [number, number, number, number],
  ) {
    if (!this.gl) {
      return
    }
    const gl = this.gl
    this.cleanupGeometry()

    const x1Array: number[] = []
    const x2Array: number[] = []
    const y1Array: number[] = []
    const y2Array: number[] = []
    const colorArray: number[] = []
    const featureIdArray: number[] = []

    for (let i = 0; i < features.length; i++) {
      const feat = features[i]!
      const { x1, x2, y1, y2 } = feat
      const [r, g, b, a] = colorFn(feat)

      x1Array.push(x1.offsetPx)
      x2Array.push(x2.offsetPx)
      y1Array.push(y1.offsetPx)
      y2Array.push(y2.offsetPx)
      colorArray.push(r / 255, g / 255, b / 255, a / 255)
      featureIdArray.push(i + 1)
    }

    this.instanceCount = features.length
    if (this.instanceCount > 0) {
      const x1Buf = this.createBuffer(gl, new Float32Array(x1Array))
      const x2Buf = this.createBuffer(gl, new Float32Array(x2Array))
      const y1Buf = this.createBuffer(gl, new Float32Array(y1Array))
      const y2Buf = this.createBuffer(gl, new Float32Array(y2Array))
      const colorBuf = this.createBuffer(gl, new Float32Array(colorArray))
      const featureIdBuf = this.createBuffer(gl, new Float32Array(featureIdArray))

      this.vao = this.setupVao(
        gl,
        this.program!,
        x1Buf,
        x2Buf,
        y1Buf,
        y2Buf,
        colorBuf,
        featureIdBuf,
      )
      this.pickingVao = this.setupVao(
        gl,
        this.pickingProgram!,
        x1Buf,
        x2Buf,
        y1Buf,
        y2Buf,
        colorBuf,
        featureIdBuf,
      )
    }
  }

  render(offsetX: number, offsetY: number, skipEdges = false) {
    if (!this.gl || !this.canvas) {
      return
    }
    const gl = this.gl

    gl.clear(gl.COLOR_BUFFER_BIT)

    if (this.vao && this.instanceCount > 0) {
      gl.useProgram(this.program)
      gl.bindVertexArray(this.vao)
      this.setUniforms(gl, this.program!, offsetX, offsetY)
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        (EDGE_CURVE_SEGMENTS + 1) * 2,
        this.instanceCount,
      )
    }

    gl.bindVertexArray(null)

    this.lastOffsetX = offsetX
    this.lastOffsetY = offsetY
    this.pickingDirty = true
  }

  private renderPicking(offsetX: number, offsetY: number) {
    if (!this.gl || !this.canvas) {
      return
    }
    const gl = this.gl
    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFramebuffer)
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.disable(gl.BLEND)

    if (this.pickingVao && this.instanceCount > 0) {
      gl.useProgram(this.pickingProgram)
      gl.bindVertexArray(this.pickingVao)
      this.setUniforms(gl, this.pickingProgram!, offsetX, offsetY)
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        (EDGE_CURVE_SEGMENTS + 1) * 2,
        this.instanceCount,
      )
    }

    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  private setUniforms(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    offsetX: number,
    offsetY: number,
  ) {
    const locs = this.uniformCache.get(program)!
    gl.uniform2f(locs.u_resolution!, this.width, this.height)
    gl.uniform1f(locs.u_offsetX!, offsetX)
    gl.uniform1f(locs.u_offsetY!, offsetY)
    if (locs.u_visibleLeft) {
      gl.uniform1f(locs.u_visibleLeft, -100)
      gl.uniform1f(locs.u_visibleRight!, this.width + 100)
    }
  }

  pick(x: number, y: number) {
    if (!this.gl || !this.canvas) {
      return -1
    }

    if (this.pickingDirty) {
      this.renderPicking(this.lastOffsetX, this.lastOffsetY)
      this.pickingDirty = false
    }

    const gl = this.gl
    const dpr = this.devicePixelRatio
    const canvasX = Math.floor(x * dpr)
    const canvasY = Math.floor(y * dpr)
    const canvasHeight = this.canvas.height

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFramebuffer)
    const pixel = new Uint8Array(4)
    gl.readPixels(canvasX, canvasHeight - canvasY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    const [r, g, b] = pixel
    if (r === 0 && g === 0 && b === 0) {
      return -1
    }
    return r! + g! * 256 + b! * 65536 - 1
  }

  hasGeometry() {
    return this.instanceCount > 0
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
    if (this.pickingProgram) {
      gl.deleteProgram(this.pickingProgram)
    }
    if (this.templateBuffer) {
      gl.deleteBuffer(this.templateBuffer)
    }
    if (this.pickingFramebuffer) {
      gl.deleteFramebuffer(this.pickingFramebuffer)
    }
    if (this.pickingTexture) {
      gl.deleteTexture(this.pickingTexture)
    }
    this.gl = null
    this.canvas = null
  }
}
