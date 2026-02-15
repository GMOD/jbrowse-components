import { category10 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

import { colorSchemes } from './drawSyntenyUtils.ts'

import type { FeatPos } from './model.ts'

// Segment counts for straight lines (no bezier needed, just a quad)
const STRAIGHT_FILL_SEGMENTS = 1
const STRAIGHT_EDGE_SEGMENTS = 1
// Segment counts for bezier curves
const CURVE_FILL_SEGMENTS = 16
const CURVE_EDGE_SEGMENTS = 8

// Split Float64 values into interleaved (hi, lo) Float32 pairs for HP
// precision on the GPU. hi = Math.fround(value), lo = value - hi.
function splitHiLo(values: number[]) {
  const result = new Float32Array(values.length * 2)
  for (const [i, value] of values.entries()) {
    const hi = Math.fround(value)
    result[i * 2] = hi
    result[i * 2 + 1] = value - hi
  }
  return result
}

function cssColorToNormalized(color: string): [number, number, number, number] {
  const { r, g, b, a } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255, a]
}

// HP (high-precision) subtraction: positions stored as (hi, lo) Float32 pairs
// where hi = Math.fround(value), lo = value - hi. Subtraction before scaling
// preserves precision for large offsetPx values during zoom.
const HP_SUBTRACT = `
float hpDiff(vec2 a, vec2 b) {
  return (a.x - b.x) + (a.y - b.y);
}
`

// Instanced fill vertex shader - evaluates bezier on GPU
// a_side = 0.0 (left edge) or 1.0 (right edge) from fill template
const FILL_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_t;
in float a_side;

in vec2 a_x1;
in vec2 a_x2;
in vec2 a_x3;
in vec2 a_x4;
in vec4 a_color;
in float a_featureId;
in float a_isCurve;
in float a_queryTotalLength;

uniform vec2 u_resolution;
uniform float u_height;
uniform vec2 u_adjOff0;
uniform vec2 u_adjOff1;
uniform float u_scale0;
uniform float u_scale1;
uniform float u_maxOffScreenPx;
uniform float u_minAlignmentLength;

out vec4 v_color;
flat out float v_featureId;

${HP_SUBTRACT}

void main() {
  // Min alignment length filter (uniform-only, no geometry rebuild needed)
  if (u_minAlignmentLength > 0.0 && a_queryTotalLength < u_minAlignmentLength) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_color = vec4(0.0);
    v_featureId = 0.0;
    return;
  }

  // Approximate culling using hi parts only (error << maxOffScreenPx margin)
  float topMinX = (min(a_x1.x, a_x2.x) - u_adjOff0.x) * u_scale0;
  float topMaxX = (max(a_x1.x, a_x2.x) - u_adjOff0.x) * u_scale0;
  float botMinX = (min(a_x3.x, a_x4.x) - u_adjOff1.x) * u_scale1;
  float botMaxX = (max(a_x3.x, a_x4.x) - u_adjOff1.x) * u_scale1;
  if (topMaxX < -u_maxOffScreenPx || topMinX > u_resolution.x + u_maxOffScreenPx ||
      botMaxX < -u_maxOffScreenPx || botMinX > u_resolution.x + u_maxOffScreenPx) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_color = vec4(0.0);
    v_featureId = 0.0;
    return;
  }

  vec2 topXHP = mix(a_x1, a_x2, a_side);
  vec2 bottomXHP = mix(a_x4, a_x3, a_side);
  float screenTopX = hpDiff(topXHP, u_adjOff0) * u_scale0;
  float screenBottomX = hpDiff(bottomXHP, u_adjOff1) * u_scale1;

  float x, y;
  if (a_isCurve > 0.5) {
    float mt = 1.0 - a_t;
    float mt2 = mt * mt;
    float mt3 = mt2 * mt;
    float t2 = a_t * a_t;
    float t3 = t2 * a_t;
    float mid = u_height * 0.5;
    x = mt3 * screenTopX + 3.0 * mt2 * a_t * screenTopX + 3.0 * mt * t2 * screenBottomX + t3 * screenBottomX;
    y = 3.0 * mt2 * a_t * mid + 3.0 * mt * t2 * mid + t3 * u_height;
  } else {
    x = mix(screenTopX, screenBottomX, a_t);
    y = a_t * u_height;
  }

  vec2 clipSpace = (vec2(x, y) / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  v_color = a_color;
  v_featureId = a_featureId;
}
`

const FILL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;

out vec4 outColor;

void main() {
  outColor = vec4(v_color.rgb * v_color.a, v_color.a);
}
`

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

// Edge vertex shader - evaluates bezier on GPU with ribbon extrusion for AA.
// Uses analytical derivatives instead of finite differences (1 eval vs 3).
// a_side = -1.0 or +1.0 from edge template
const EDGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_t;
in float a_side;

in vec2 a_x1;
in vec2 a_x2;
in vec2 a_x3;
in vec2 a_x4;
in vec4 a_color;
in float a_featureId;
in float a_isCurve;
in float a_queryTotalLength;

uniform vec2 u_resolution;
uniform float u_height;
uniform vec2 u_adjOff0;
uniform vec2 u_adjOff1;
uniform float u_scale0;
uniform float u_scale1;
uniform float u_maxOffScreenPx;
uniform float u_minAlignmentLength;

out vec4 v_color;
out float v_dist;
flat out float v_featureId;

${HP_SUBTRACT}

void main() {
  if (u_minAlignmentLength > 0.0 && a_queryTotalLength < u_minAlignmentLength) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_color = vec4(0.0);
    v_dist = 0.0;
    v_featureId = 0.0;
    return;
  }

  float topMinX = (min(a_x1.x, a_x2.x) - u_adjOff0.x) * u_scale0;
  float topMaxX = (max(a_x1.x, a_x2.x) - u_adjOff0.x) * u_scale0;
  float botMinX = (min(a_x3.x, a_x4.x) - u_adjOff1.x) * u_scale1;
  float botMaxX = (max(a_x3.x, a_x4.x) - u_adjOff1.x) * u_scale1;
  if (topMaxX < -u_maxOffScreenPx || topMinX > u_resolution.x + u_maxOffScreenPx ||
      botMaxX < -u_maxOffScreenPx || botMinX > u_resolution.x + u_maxOffScreenPx) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_color = vec4(0.0);
    v_dist = 0.0;
    v_featureId = 0.0;
    return;
  }

  vec2 topXHP = mix(a_x1, a_x2, step(0.0, a_side));
  vec2 bottomXHP = mix(a_x4, a_x3, step(0.0, a_side));
  float screenTopX = hpDiff(topXHP, u_adjOff0) * u_scale0;
  float screenBottomX = hpDiff(bottomXHP, u_adjOff1) * u_scale1;

  float mt = 1.0 - a_t;
  vec2 pos;
  vec2 tangent;

  if (a_isCurve > 0.5) {
    float mt2 = mt * mt;
    float mt3 = mt2 * mt;
    float t2 = a_t * a_t;
    float t3 = t2 * a_t;
    float mid = u_height * 0.5;
    // Bezier position: B(t) with P0=(topX,0) P1=(topX,mid) P2=(botX,mid) P3=(botX,h)
    float px = mt3 * screenTopX + 3.0 * mt2 * a_t * screenTopX + 3.0 * mt * t2 * screenBottomX + t3 * screenBottomX;
    float py = 3.0 * mt2 * a_t * mid + 3.0 * mt * t2 * mid + t3 * u_height;
    pos = vec2(px, py);
    // Analytical derivative: B'(t) = 3(1-t)²(P1-P0) + 6(1-t)t(P2-P1) + 3t²(P3-P2)
    float dx = 6.0 * mt * a_t * (screenBottomX - screenTopX);
    float dy = 3.0 * mid * (mt2 + t2);
    tangent = vec2(dx, dy);
  } else {
    pos = vec2(mix(screenTopX, screenBottomX, a_t), a_t * u_height);
    tangent = vec2(screenBottomX - screenTopX, u_height);
  }

  float tangentLen = length(tangent);
  vec2 normal;
  if (tangentLen > 0.001) {
    normal = vec2(-tangent.y, tangent.x) / tangentLen;
  } else {
    normal = vec2(0.0, 1.0);
  }

  pos += normal * a_side;

  vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);

  v_dist = a_side;
  v_color = a_color;
  v_featureId = a_featureId;
}
`

const EDGE_FRAGMENT_SHADER = `#version 300 es
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

export class SyntenyWebGLRenderer {
  private gl: WebGL2RenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private width = 0
  private height = 0
  private devicePixelRatio = 1

  // Programs
  private fillProgram: WebGLProgram | null = null
  private fillPickingProgram: WebGLProgram | null = null
  private edgeProgram: WebGLProgram | null = null
  private edgePickingProgram: WebGLProgram | null = null

  // VAOs (all share the same instance buffers)
  private fillVao: WebGLVertexArrayObject | null = null
  private fillPickingVao: WebGLVertexArrayObject | null = null
  private edgeVao: WebGLVertexArrayObject | null = null
  private edgePickingVao: WebGLVertexArrayObject | null = null
  private instanceCount = 0
  private nonCigarInstanceCount = 0

  // Template buffers
  private fillTemplateBuffer: WebGLBuffer | null = null
  private edgeTemplateBuffer: WebGLBuffer | null = null

  // Picking framebuffer
  private pickingFramebuffer: WebGLFramebuffer | null = null
  private pickingTexture: WebGLTexture | null = null
  private pickingDirty = true
  private lastHeight = 0
  private lastAdjOff0Hi = 0
  private lastAdjOff0Lo = 0
  private lastAdjOff1Hi = 0
  private lastAdjOff1Lo = 0
  private lastScale0 = 1
  private lastScale1 = 1
  private lastMaxOffScreenPx = 300
  private lastMinAlignmentLength = 0

  // bpPerPx used when geometry was built, for zoom-correction scaling
  private geometryBpPerPx0 = 1
  private geometryBpPerPx1 = 1

  // Cached uniform locations per program
  private uniformCache = new Map<
    WebGLProgram,
    Record<string, WebGLUniformLocation | null>
  >()

  // Dynamic segment counts (rebuilt when drawCurves changes)
  private currentFillSegments = 0
  private currentEdgeSegments = 0
  private fillVerticesPerInstance = 0
  private edgeVerticesPerInstance = 0

  // All allocated buffers for cleanup
  private allocatedBuffers: WebGLBuffer[] = []
  private pickingPixel = new Uint8Array(4)

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
      this.fillProgram = createProgram(
        gl,
        FILL_VERTEX_SHADER,
        FILL_FRAGMENT_SHADER,
      )
      this.fillPickingProgram = createProgram(
        gl,
        FILL_VERTEX_SHADER,
        PICKING_FRAGMENT_SHADER,
      )
      this.edgeProgram = createProgram(
        gl,
        EDGE_VERTEX_SHADER,
        EDGE_FRAGMENT_SHADER,
      )
      this.edgePickingProgram = createProgram(
        gl,
        EDGE_VERTEX_SHADER,
        PICKING_FRAGMENT_SHADER,
      )

      // Cache uniform locations for all programs
      const uniformNames = [
        'u_resolution',
        'u_height',
        'u_adjOff0',
        'u_adjOff1',
        'u_scale0',
        'u_scale1',
        'u_maxOffScreenPx',
        'u_minAlignmentLength',
      ]
      for (const program of [
        this.fillProgram,
        this.fillPickingProgram,
        this.edgeProgram,
        this.edgePickingProgram,
      ]) {
        const locs: Record<string, WebGLUniformLocation | null> = {}
        for (const name of uniformNames) {
          locs[name] = gl.getUniformLocation(program, name)
        }
        this.uniformCache.set(program, locs)
      }

      // Picking framebuffer
      this.pickingFramebuffer = gl.createFramebuffer()!
      this.pickingTexture = gl.createTexture()!
      this.resizePickingBuffer(canvas.width, canvas.height)

      // Set initial GL state
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

  private rebuildTemplates(fillSegments: number, edgeSegments: number) {
    if (
      fillSegments === this.currentFillSegments &&
      edgeSegments === this.currentEdgeSegments &&
      this.fillTemplateBuffer &&
      this.edgeTemplateBuffer
    ) {
      return
    }

    const gl = this.gl!
    if (this.fillTemplateBuffer) {
      gl.deleteBuffer(this.fillTemplateBuffer)
    }
    if (this.edgeTemplateBuffer) {
      gl.deleteBuffer(this.edgeTemplateBuffer)
    }

    this.currentFillSegments = fillSegments
    this.currentEdgeSegments = edgeSegments
    this.fillVerticesPerInstance = fillSegments * 6
    this.edgeVerticesPerInstance = (edgeSegments + 1) * 2

    const fillTemplateData = new Float32Array(this.fillVerticesPerInstance * 2)
    for (let s = 0; s < fillSegments; s++) {
      const t0 = s / fillSegments
      const t1 = (s + 1) / fillSegments
      const base = s * 12
      fillTemplateData[base + 0] = t0
      fillTemplateData[base + 1] = 0
      fillTemplateData[base + 2] = t0
      fillTemplateData[base + 3] = 1
      fillTemplateData[base + 4] = t1
      fillTemplateData[base + 5] = 0
      fillTemplateData[base + 6] = t1
      fillTemplateData[base + 7] = 0
      fillTemplateData[base + 8] = t0
      fillTemplateData[base + 9] = 1
      fillTemplateData[base + 10] = t1
      fillTemplateData[base + 11] = 1
    }
    this.fillTemplateBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fillTemplateBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, fillTemplateData, gl.STATIC_DRAW)

    const edgeTemplateData = new Float32Array(this.edgeVerticesPerInstance * 2)
    for (let i = 0; i <= edgeSegments; i++) {
      const t = i / edgeSegments
      const base = i * 4
      edgeTemplateData[base + 0] = t
      edgeTemplateData[base + 1] = 1
      edgeTemplateData[base + 2] = t
      edgeTemplateData[base + 3] = -1
    }
    this.edgeTemplateBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeTemplateBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, edgeTemplateData, gl.STATIC_DRAW)
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
  }

  private cleanupGeometry() {
    const gl = this.gl
    if (!gl) {
      return
    }
    if (this.fillVao) {
      gl.deleteVertexArray(this.fillVao)
      this.fillVao = null
    }
    if (this.fillPickingVao) {
      gl.deleteVertexArray(this.fillPickingVao)
      this.fillPickingVao = null
    }
    if (this.edgeVao) {
      gl.deleteVertexArray(this.edgeVao)
      this.edgeVao = null
    }
    if (this.edgePickingVao) {
      gl.deleteVertexArray(this.edgePickingVao)
      this.edgePickingVao = null
    }
    for (const buf of this.allocatedBuffers) {
      gl.deleteBuffer(buf)
    }
    this.allocatedBuffers = []
    this.instanceCount = 0
    this.nonCigarInstanceCount = 0

  }

  private createBuffer(gl: WebGL2RenderingContext, data: Float32Array) {
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    this.allocatedBuffers.push(buf)
    return buf
  }

  private setupInstancedVao(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    templateBuffer: WebGLBuffer,
    x1Buf: WebGLBuffer,
    x2Buf: WebGLBuffer,
    x3Buf: WebGLBuffer,
    x4Buf: WebGLBuffer,
    colorBuf: WebGLBuffer,
    featureIdBuf: WebGLBuffer,
    isCurveBuf: WebGLBuffer,
    queryTotalLengthBuf: WebGLBuffer,
  ) {
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    // Per-vertex template (t and side)
    const stride = 2 * 4
    const tLoc = gl.getAttribLocation(program, 'a_t')
    gl.bindBuffer(gl.ARRAY_BUFFER, templateBuffer)
    gl.enableVertexAttribArray(tLoc)
    gl.vertexAttribPointer(tLoc, 1, gl.FLOAT, false, stride, 0)

    const sideLoc = gl.getAttribLocation(program, 'a_side')
    gl.bindBuffer(gl.ARRAY_BUFFER, templateBuffer)
    gl.enableVertexAttribArray(sideLoc)
    gl.vertexAttribPointer(sideLoc, 1, gl.FLOAT, false, stride, 4)

    // Per-instance position attributes (vec2: hi/lo for HP precision)
    const posAttrs: [string, WebGLBuffer][] = [
      ['a_x1', x1Buf],
      ['a_x2', x2Buf],
      ['a_x3', x3Buf],
      ['a_x4', x4Buf],
    ]
    for (const [name, buf] of posAttrs) {
      const loc = gl.getAttribLocation(program, name)
      if (loc >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
        gl.vertexAttribDivisor(loc, 1)
      }
    }

    // Per-instance scalar attributes
    const scalarAttrs: [string, WebGLBuffer][] = [
      ['a_featureId', featureIdBuf],
      ['a_isCurve', isCurveBuf],
      ['a_queryTotalLength', queryTotalLengthBuf],
    ]
    for (const [name, buf] of scalarAttrs) {
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
    featPositions: FeatPos[],
    level: number,
    alpha: number,
    colorBy: string,
    colorFn: (f: FeatPos, index: number) => [number, number, number, number],
    drawCurves: boolean,
    drawCIGAR: boolean,
    drawCIGARMatchesOnly: boolean,
    bpPerPxs: number[],
    drawLocationMarkers: boolean,
  ) {
    if (!this.gl) {
      return
    }
    const gl = this.gl
    this.cleanupGeometry()

    const fillSegments = drawCurves
      ? CURVE_FILL_SEGMENTS
      : STRAIGHT_FILL_SEGMENTS
    const edgeSegments = drawCurves
      ? CURVE_EDGE_SEGMENTS
      : STRAIGHT_EDGE_SEGMENTS
    this.rebuildTemplates(fillSegments, edgeSegments)

    // Store bpPerPx used for this geometry so we can scale correctly if
    // the view zooms before new geometry arrives from RPC. Without this,
    // the old geometry (in old pixel coords) rendered with new offsets
    // causes a visible glitch. The shader multiplies positions by
    // geometryBpPerPx/currentBpPerPx to compensate. Note: inter-region
    // padding doesn't scale with bpPerPx, so positions near region
    // boundaries may be slightly off until the RPC returns fresh geometry
    this.geometryBpPerPx0 = bpPerPxs[level]!
    this.geometryBpPerPx1 = bpPerPxs[level + 1]!

    // Compute query total alignment lengths for GPU-side filtering
    const queryTotalLengths = new Map<string, number>()
    for (const { f } of featPositions) {
      const queryName = f.get('name') || f.get('id') || f.id()
      const alignmentLength = Math.abs(f.get('end') - f.get('start'))
      const current = queryTotalLengths.get(queryName) || 0
      queryTotalLengths.set(queryName, current + alignmentLength)
    }

    // Instance data arrays (shared by fill and edge passes)
    // Non-CIGAR instances come first so edge pass can skip CIGAR segments
    const x1s: number[] = []
    const x2s: number[] = []
    const x3s: number[] = []
    const x4s: number[] = []
    const colors: number[] = []
    const featureIds: number[] = []
    const isCurves: number[] = []
    const queryTotalLengthArr: number[] = []

    const isCurve = drawCurves ? 1 : 0
    const fallbackBpPerPxInv0 = 1 / bpPerPxs[level]!
    const fallbackBpPerPxInv1 = 1 / bpPerPxs[level + 1]!

    // Minimum pixel width for meaningful CIGAR decomposition. Features thinner
    // than this are drawn as single instances with edge rendering instead of
    // being decomposed into invisible sub-pixel CIGAR segments.
    const minCigarPxWidth = 4

    // Pass 1: non-CIGAR features + CIGAR features too thin to decompose
    // (these get edge rendering which keeps thin features visible)
    for (const [i, featPosition] of featPositions.entries()) {
      const feat = featPosition
      const { p11, p12, p21, p22, f, cigar } = feat
      if (cigar.length > 0 && drawCIGAR) {
        const featureWidth = Math.max(
          Math.abs(p12.offsetPx - p11.offsetPx),
          Math.abs(p22.offsetPx - p21.offsetPx),
        )
        if (featureWidth >= minCigarPxWidth) {
          continue
        }
      }
      const x11 = p11.offsetPx
      const x12 = p12.offsetPx
      const x21 = p21.offsetPx
      const x22 = p22.offsetPx
      const featureId = i + 1
      const queryName = f.get('name') || f.get('id') || f.id()
      const qtl = queryTotalLengths.get(queryName) || 0

      const [cr, cg, cb, ca] = colorFn(feat, i)
      x1s.push(x11)
      x2s.push(x12)
      x3s.push(x22)
      x4s.push(x21)
      colors.push(cr, cg, cb, ca)
      featureIds.push(featureId)
      isCurves.push(isCurve)
      queryTotalLengthArr.push(qtl)

      if (drawLocationMarkers) {
        addLocationMarkerInstances(
          x1s,
          x2s,
          x3s,
          x4s,
          colors,
          featureIds,
          isCurves,
          queryTotalLengthArr,
          x11,
          x12,
          x22,
          x21,
          featureId,
          isCurve,
          qtl,
        )
      }
    }

    // Edge pass only draws up to this count (skips CIGAR segments)
    this.nonCigarInstanceCount = x1s.length

    // Pass 2: CIGAR features wide enough to decompose (no edge rendering to
    // avoid boundary artifacts). Thin features were already drawn in Pass 1.
    for (const [i, featPosition] of featPositions.entries()) {
      const feat = featPosition
      const { p11, p12, p21, p22, f, cigar } = feat
      if (!(cigar.length > 0 && drawCIGAR)) {
        continue
      }

      const featureWidth = Math.max(
        Math.abs(p12.offsetPx - p11.offsetPx),
        Math.abs(p22.offsetPx - p21.offsetPx),
      )
      if (featureWidth < minCigarPxWidth) {
        continue
      }
      const x11 = p11.offsetPx
      const x12 = p12.offsetPx
      const x21 = p21.offsetPx
      const x22 = p22.offsetPx
      const strand = f.get('strand') as number
      const featureId = i + 1
      const queryName = f.get('name') || f.get('id') || f.id()
      const qtl = queryTotalLengths.get(queryName) || 0

      const s1 = strand
      const k1 = s1 === -1 ? x12 : x11
      const k2 = s1 === -1 ? x11 : x12
      const rev1 = k1 < k2 ? 1 : -1
      const rev2 = (x21 < x22 ? 1 : -1) * s1

      // Zoom-relative: derive per-feature px/bp from actual pixel positions
      // so CIGAR segments tile perfectly at any zoom level
      let totalBpView0 = 0
      let totalBpView1 = 0
      for (let j = 0; j < cigar.length; j += 2) {
        const len = +cigar[j]!
        const op = cigar[j + 1]!
        if (op === 'M' || op === '=' || op === 'X') {
          totalBpView0 += len
          totalBpView1 += len
        } else if (op === 'D' || op === 'N') {
          totalBpView0 += len
        } else if (op === 'I') {
          totalBpView1 += len
        }
      }
      const pxPerBp0 =
        totalBpView0 > 0
          ? Math.abs(k2 - k1) / totalBpView0
          : fallbackBpPerPxInv0
      const pxPerBp1 =
        totalBpView1 > 0
          ? Math.abs(x22 - x21) / totalBpView1
          : fallbackBpPerPxInv1

      let cx1 = k1
      let cx2 = s1 === -1 ? x22 : x21
      let continuingFlag = false
      let px1 = 0
      let px2 = 0

      for (let j = 0; j < cigar.length; j += 2) {
        const len = +cigar[j]!
        const op = cigar[j + 1]!

        if (!continuingFlag) {
          px1 = cx1
          px2 = cx2
        }

        const d1 = len * pxPerBp0
        const d2 = len * pxPerBp1

        if (op === 'M' || op === '=' || op === 'X') {
          cx1 += d1 * rev1
          cx2 += d2 * rev2
        } else if (op === 'D' || op === 'N') {
          cx1 += d1 * rev1
        } else if (op === 'I') {
          cx2 += d2 * rev2
        }

        // Adaptively skip sub-pixel D/I/N ops when zoomed out: merge them
        // into surrounding match segments to avoid visual noise
        if (op === 'D' || op === 'N' || op === 'I') {
          const relevantPx = op === 'I' ? d2 : d1
          if (relevantPx < 1) {
            continuingFlag = true
            continue
          }
        }

        const isNotLast = j < cigar.length - 2
        if (Math.abs(cx1 - px1) <= 1 && Math.abs(cx2 - px2) <= 1 && isNotLast) {
          continuingFlag = true
        } else {
          const letter = (continuingFlag && d1 > 1) || d2 > 1 ? op : 'M'
          continuingFlag = false

          if (drawCIGARMatchesOnly && letter !== 'M') {
            continue
          }

          const [cr, cg, cb, ca] = getCigarColor(
            letter,
            colorBy,
            colorFn,
            feat,
            i,
            alpha,
          )
          x1s.push(px1)
          x2s.push(cx1)
          x3s.push(cx2)
          x4s.push(px2)
          colors.push(cr, cg, cb, ca)
          featureIds.push(featureId)
          isCurves.push(isCurve)
          queryTotalLengthArr.push(qtl)

          if (drawLocationMarkers) {
            addLocationMarkerInstances(
              x1s,
              x2s,
              x3s,
              x4s,
              colors,
              featureIds,
              isCurves,
              queryTotalLengthArr,
              px1,
              cx1,
              cx2,
              px2,
              featureId,
              isCurve,
              qtl,
            )
          }
        }
      }
    }

    // Upload instance buffers (shared by all 4 VAOs)
    this.instanceCount = x1s.length
    if (this.instanceCount > 0) {
      const x1Buf = this.createBuffer(gl, splitHiLo(x1s))
      const x2Buf = this.createBuffer(gl, splitHiLo(x2s))
      const x3Buf = this.createBuffer(gl, splitHiLo(x3s))
      const x4Buf = this.createBuffer(gl, splitHiLo(x4s))
      const colorBuf = this.createBuffer(gl, new Float32Array(colors))
      const featureIdBuf = this.createBuffer(gl, new Float32Array(featureIds))
      const isCurveBuf = this.createBuffer(gl, new Float32Array(isCurves))
      const queryTotalLengthBuf = this.createBuffer(
        gl,
        new Float32Array(queryTotalLengthArr),
      )

      this.fillVao = this.setupInstancedVao(
        gl,
        this.fillProgram!,
        this.fillTemplateBuffer!,
        x1Buf,
        x2Buf,
        x3Buf,
        x4Buf,
        colorBuf,
        featureIdBuf,
        isCurveBuf,
        queryTotalLengthBuf,
      )
      this.fillPickingVao = this.setupInstancedVao(
        gl,
        this.fillPickingProgram!,
        this.fillTemplateBuffer!,
        x1Buf,
        x2Buf,
        x3Buf,
        x4Buf,
        colorBuf,
        featureIdBuf,
        isCurveBuf,
        queryTotalLengthBuf,
      )
      this.edgeVao = this.setupInstancedVao(
        gl,
        this.edgeProgram!,
        this.edgeTemplateBuffer!,
        x1Buf,
        x2Buf,
        x3Buf,
        x4Buf,
        colorBuf,
        featureIdBuf,
        isCurveBuf,
        queryTotalLengthBuf,
      )
      this.edgePickingVao = this.setupInstancedVao(
        gl,
        this.edgePickingProgram!,
        this.edgeTemplateBuffer!,
        x1Buf,
        x2Buf,
        x3Buf,
        x4Buf,
        colorBuf,
        featureIdBuf,
        isCurveBuf,
        queryTotalLengthBuf,
      )
    }
  }

  render(
    offset0: number,
    offset1: number,
    height: number,
    curBpPerPx0: number,
    curBpPerPx1: number,
    skipEdges = false,
    maxOffScreenPx = 300,
    minAlignmentLength = 0,
  ) {
    if (!this.gl || !this.canvas) {
      return
    }
    const gl = this.gl
    const scale0 = this.geometryBpPerPx0 / curBpPerPx0
    const scale1 = this.geometryBpPerPx1 / curBpPerPx1

    // Compute adjusted offsets at Float64, then split into hi/lo for the
    // shader's HP subtraction: screenX = (pos - adjOff) * scale
    const adjOff0 = offset0 / scale0
    const adjOff1 = offset1 / scale1
    const adjOff0Hi = Math.fround(adjOff0)
    const adjOff0Lo = adjOff0 - adjOff0Hi
    const adjOff1Hi = Math.fround(adjOff1)
    const adjOff1Lo = adjOff1 - adjOff1Hi

    gl.clear(gl.COLOR_BUFFER_BIT)

    // Draw fills (instanced)
    if (this.fillVao && this.instanceCount > 0) {
      gl.useProgram(this.fillProgram)
      gl.bindVertexArray(this.fillVao)
      this.setUniforms(
        gl,
        this.fillProgram!,
        height,
        adjOff0Hi,
        adjOff0Lo,
        adjOff1Hi,
        adjOff1Lo,
        scale0,
        scale1,
        maxOffScreenPx,
        minAlignmentLength,
      )
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        this.fillVerticesPerInstance,
        this.instanceCount,
      )
    }

    // Draw AA edges on top (skipped during scroll for performance)
    // Only draw edges for non-CIGAR instances to avoid boundary artifacts
    if (!skipEdges && this.edgeVao && this.nonCigarInstanceCount > 0) {
      gl.useProgram(this.edgeProgram)
      gl.bindVertexArray(this.edgeVao)
      this.setUniforms(
        gl,
        this.edgeProgram!,
        height,
        adjOff0Hi,
        adjOff0Lo,
        adjOff1Hi,
        adjOff1Lo,
        scale0,
        scale1,
        maxOffScreenPx,
        minAlignmentLength,
      )
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        this.edgeVerticesPerInstance,
        this.nonCigarInstanceCount,
      )
    }

    gl.bindVertexArray(null)

    this.lastHeight = height
    this.lastAdjOff0Hi = adjOff0Hi
    this.lastAdjOff0Lo = adjOff0Lo
    this.lastAdjOff1Hi = adjOff1Hi
    this.lastAdjOff1Lo = adjOff1Lo
    this.lastScale0 = scale0
    this.lastScale1 = scale1
    this.lastMaxOffScreenPx = maxOffScreenPx
    this.lastMinAlignmentLength = minAlignmentLength
    this.pickingDirty = true
  }

  renderPicking(
    height: number,
    adjOff0Hi: number,
    adjOff0Lo: number,
    adjOff1Hi: number,
    adjOff1Lo: number,
    scale0: number,
    scale1: number,
    maxOffScreenPx: number,
    minAlignmentLength: number,
  ) {
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

    // Draw fills for picking (instanced)
    if (this.fillPickingVao && this.instanceCount > 0) {
      gl.useProgram(this.fillPickingProgram)
      gl.bindVertexArray(this.fillPickingVao)
      this.setUniforms(
        gl,
        this.fillPickingProgram!,
        height,
        adjOff0Hi,
        adjOff0Lo,
        adjOff1Hi,
        adjOff1Lo,
        scale0,
        scale1,
        maxOffScreenPx,
        minAlignmentLength,
      )
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        this.fillVerticesPerInstance,
        this.instanceCount,
      )
    }

    // Draw edges for picking (instanced) - only non-CIGAR instances
    if (this.edgePickingVao && this.nonCigarInstanceCount > 0) {
      gl.useProgram(this.edgePickingProgram)
      gl.bindVertexArray(this.edgePickingVao)
      this.setUniforms(
        gl,
        this.edgePickingProgram!,
        height,
        adjOff0Hi,
        adjOff0Lo,
        adjOff1Hi,
        adjOff1Lo,
        scale0,
        scale1,
        maxOffScreenPx,
        minAlignmentLength,
      )
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        this.edgeVerticesPerInstance,
        this.nonCigarInstanceCount,
      )
    }

    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    // Restore state
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  private setUniforms(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    height: number,
    adjOff0Hi: number,
    adjOff0Lo: number,
    adjOff1Hi: number,
    adjOff1Lo: number,
    scale0: number,
    scale1: number,
    maxOffScreenPx: number,
    minAlignmentLength: number,
  ) {
    const locs = this.uniformCache.get(program)!
    gl.uniform2f(locs.u_resolution!, this.width, this.height)
    gl.uniform1f(locs.u_height!, height)
    gl.uniform2f(locs.u_adjOff0!, adjOff0Hi, adjOff0Lo)
    gl.uniform2f(locs.u_adjOff1!, adjOff1Hi, adjOff1Lo)
    gl.uniform1f(locs.u_scale0!, scale0)
    gl.uniform1f(locs.u_scale1!, scale1)
    if (locs.u_maxOffScreenPx) {
      gl.uniform1f(locs.u_maxOffScreenPx, maxOffScreenPx)
    }
    if (locs.u_minAlignmentLength) {
      gl.uniform1f(locs.u_minAlignmentLength, minAlignmentLength)
    }
  }

  pick(x: number, y: number) {
    if (!this.gl || !this.canvas) {
      return -1
    }

    if (this.pickingDirty) {
      this.renderPicking(
        this.lastHeight,
        this.lastAdjOff0Hi,
        this.lastAdjOff0Lo,
        this.lastAdjOff1Hi,
        this.lastAdjOff1Lo,
        this.lastScale0,
        this.lastScale1,
        this.lastMaxOffScreenPx,
        this.lastMinAlignmentLength,
      )
      this.pickingDirty = false
    }

    const gl = this.gl
    const dpr = this.devicePixelRatio
    const canvasX = Math.floor(x * dpr)
    const canvasY = Math.floor(y * dpr)
    const canvasHeight = this.canvas.height

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFramebuffer)
    gl.readPixels(
      canvasX,
      canvasHeight - canvasY,
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.pickingPixel,
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    const [r, g, b] = this.pickingPixel
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
    if (this.fillProgram) {
      gl.deleteProgram(this.fillProgram)
    }
    if (this.fillPickingProgram) {
      gl.deleteProgram(this.fillPickingProgram)
    }
    if (this.edgeProgram) {
      gl.deleteProgram(this.edgeProgram)
    }
    if (this.edgePickingProgram) {
      gl.deleteProgram(this.edgePickingProgram)
    }
    if (this.fillTemplateBuffer) {
      gl.deleteBuffer(this.fillTemplateBuffer)
    }
    if (this.edgeTemplateBuffer) {
      gl.deleteBuffer(this.edgeTemplateBuffer)
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

// Helper: get color for a CIGAR operation
function getCigarColor(
  letter: string,
  colorBy: string,
  colorFn: (f: FeatPos, index: number) => [number, number, number, number],
  feat: FeatPos,
  index: number,
  alpha: number,
): [number, number, number, number] {
  const isInsertionOrDeletion =
    letter === 'I' || letter === 'D' || letter === 'N'

  if (!isInsertionOrDeletion) {
    return colorFn(feat, index)
  }

  const scheme =
    colorBy === 'strand' ? colorSchemes.strand : colorSchemes.default
  const cigarColors = scheme.cigarColors
  const color = cigarColors[letter as keyof typeof cigarColors]
  if (color) {
    const [r, g, b, a] = cssColorToNormalized(color)
    return [r, g, b, a * alpha]
  }
  return colorFn(feat, index)
}

// Push location marker instances (thin semi-transparent lines across large blocks)
function addLocationMarkerInstances(
  x1s: number[],
  x2s: number[],
  x3s: number[],
  x4s: number[],
  colors: number[],
  featureIds: number[],
  isCurves: number[],
  queryTotalLengthArr: number[],
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
  featureId: number,
  isCurve: number,
  queryTotalLength: number,
) {
  const width1 = Math.abs(topRight - topLeft)
  const width2 = Math.abs(bottomRight - bottomLeft)
  const averageWidth = (width1 + width2) / 2

  if (averageWidth < 30) {
    return
  }

  const targetPixelSpacing = 20
  const numMarkers = Math.max(
    2,
    Math.floor(averageWidth / targetPixelSpacing) + 1,
  )

  const lineHalfWidth = 0.25

  for (let step = 0; step < numMarkers; step++) {
    const t = step / numMarkers
    const markerTopX = topLeft + (topRight - topLeft) * t
    const markerBottomX = bottomLeft + (bottomRight - bottomLeft) * t

    x1s.push(markerTopX - lineHalfWidth)
    x2s.push(markerTopX + lineHalfWidth)
    x3s.push(markerBottomX + lineHalfWidth)
    x4s.push(markerBottomX - lineHalfWidth)
    colors.push(0, 0, 0, 0.25)
    featureIds.push(featureId)
    isCurves.push(isCurve)
    queryTotalLengthArr.push(queryTotalLength)
  }
}

// Simple hash function for consistent query colors
function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// Pre-computed category10 colors in normalized RGB
const category10Normalized = category10.map(hex => {
  const { r, g, b } = colord(hex).toRgb()
  return [r / 255, g / 255, b / 255] as [number, number, number]
})

export function createColorFunction(
  colorBy: string,
  alpha: number,
): (f: FeatPos, index: number) => [number, number, number, number] {
  if (colorBy === 'strand') {
    return (f: FeatPos) => {
      const strand = f.f.get('strand')
      return strand === -1 ? [0, 0, 1, alpha] : [1, 0, 0, alpha]
    }
  }

  if (colorBy === 'query') {
    const colorCache = new Map<string, [number, number, number, number]>()
    return (f: FeatPos) => {
      const name = f.f.get('refName') || ''
      if (!colorCache.has(name)) {
        const hash = hashString(name)
        const [r, g, b] =
          category10Normalized[hash % category10Normalized.length]!
        colorCache.set(name, [r, g, b, alpha])
      }
      return colorCache.get(name)!
    }
  }

  // Default: red
  return () => [1, 0, 0, alpha]
}
