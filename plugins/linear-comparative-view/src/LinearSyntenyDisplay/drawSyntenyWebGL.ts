import { category10 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

import { colorSchemes } from './drawSyntenyUtils.ts'

import type { defaultCigarColors } from './drawSyntenyUtils.ts'
import type { FeatPos } from './model.ts'

// Number of segments for bezier tessellation (fill and edge passes)
const SEGMENTS = 32

function cssColorToNormalized(color: string): [number, number, number, number] {
  const { r, g, b, a } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255, a]
}

// Instanced fill vertex shader - evaluates bezier on GPU
// a_side = 0.0 (left edge) or 1.0 (right edge) from fill template
const FILL_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_t;
in float a_side;

in float a_x1;
in float a_x2;
in float a_x3;
in float a_x4;
in vec4 a_color;
in float a_featureId;
in float a_isCurve;

uniform vec2 u_resolution;
uniform float u_height;
uniform float u_offset0;
uniform float u_offset1;
uniform float u_visibleLeft;
uniform float u_visibleRight;

out vec4 v_color;
flat out float v_featureId;

void main() {
  float screenMinX = min(min(a_x1, a_x2) - u_offset0, min(a_x3, a_x4) - u_offset1);
  float screenMaxX = max(max(a_x1, a_x2) - u_offset0, max(a_x3, a_x4) - u_offset1);
  if (screenMaxX < u_visibleLeft || screenMinX > u_visibleRight) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_color = vec4(0.0);
    v_featureId = 0.0;
    return;
  }

  float topX = mix(a_x1, a_x2, a_side);
  float bottomX = mix(a_x4, a_x3, a_side);
  float screenTopX = topX - u_offset0;
  float screenBottomX = bottomX - u_offset1;

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

// Edge vertex shader - evaluates bezier on GPU with ribbon extrusion for AA
// a_side = -1.0 or +1.0 from edge template
const EDGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_t;
in float a_side;

in float a_x1;
in float a_x2;
in float a_x3;
in float a_x4;
in vec4 a_color;
in float a_featureId;
in float a_isCurve;

uniform vec2 u_resolution;
uniform float u_height;
uniform float u_offset0;
uniform float u_offset1;
uniform float u_visibleLeft;
uniform float u_visibleRight;

out vec4 v_color;
out float v_dist;
flat out float v_featureId;

vec2 evalEdge(float t, float topX, float bottomX, float isCurve) {
  float screenTopX = topX - u_offset0;
  float screenBottomX = bottomX - u_offset1;

  if (isCurve > 0.5) {
    float mt = 1.0 - t;
    float mt2 = mt * mt;
    float mt3 = mt2 * mt;
    float t2 = t * t;
    float t3 = t2 * t;
    float mid = u_height * 0.5;
    float x = mt3 * screenTopX + 3.0 * mt2 * t * screenTopX + 3.0 * mt * t2 * screenBottomX + t3 * screenBottomX;
    float y = 3.0 * mt2 * t * mid + 3.0 * mt * t2 * mid + t3 * u_height;
    return vec2(x, y);
  }

  float y = t * u_height;
  float x = mix(screenTopX, screenBottomX, t);
  return vec2(x, y);
}

void main() {
  float screenMinX = min(min(a_x1, a_x2) - u_offset0, min(a_x3, a_x4) - u_offset1);
  float screenMaxX = max(max(a_x1, a_x2) - u_offset0, max(a_x3, a_x4) - u_offset1);
  if (screenMaxX < u_visibleLeft || screenMinX > u_visibleRight) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_color = vec4(0.0);
    v_dist = 0.0;
    v_featureId = 0.0;
    return;
  }

  float topX = mix(a_x1, a_x2, step(0.0, a_side));
  float bottomX = mix(a_x4, a_x3, step(0.0, a_side));

  vec2 pos = evalEdge(a_t, topX, bottomX, a_isCurve);

  float eps = 1.0 / float(${SEGMENTS});
  float t0 = max(a_t - eps * 0.5, 0.0);
  float t1 = min(a_t + eps * 0.5, 1.0);
  vec2 p0 = evalEdge(t0, topX, bottomX, a_isCurve);
  vec2 p1 = evalEdge(t1, topX, bottomX, a_isCurve);
  vec2 tangent = p1 - p0;
  float tangentLen = length(tangent);

  vec2 normal;
  if (tangentLen > 0.001) {
    tangent /= tangentLen;
    normal = vec2(-tangent.y, tangent.x);
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

// Number of template vertices per instance
const FILL_VERTICES_PER_INSTANCE = SEGMENTS * 6
const EDGE_VERTICES_PER_INSTANCE = (SEGMENTS + 1) * 2

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

  // Template buffers
  private fillTemplateBuffer: WebGLBuffer | null = null
  private edgeTemplateBuffer: WebGLBuffer | null = null

  // Picking framebuffer
  private pickingFramebuffer: WebGLFramebuffer | null = null
  private pickingTexture: WebGLTexture | null = null
  private pickingDirty = true
  private lastOffset0 = 0
  private lastOffset1 = 0
  private lastHeight = 0

  // Cached uniform locations per program
  private uniformCache = new Map<WebGLProgram, Record<string, WebGLUniformLocation | null>>()

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
      this.fillProgram = createProgram(gl, FILL_VERTEX_SHADER, FILL_FRAGMENT_SHADER)
      this.fillPickingProgram = createProgram(gl, FILL_VERTEX_SHADER, PICKING_FRAGMENT_SHADER)
      this.edgeProgram = createProgram(gl, EDGE_VERTEX_SHADER, EDGE_FRAGMENT_SHADER)
      this.edgePickingProgram = createProgram(gl, EDGE_VERTEX_SHADER, PICKING_FRAGMENT_SHADER)

      // Cache uniform locations for all programs
      const uniformNames = ['u_resolution', 'u_height', 'u_offset0', 'u_offset1', 'u_visibleLeft', 'u_visibleRight']
      for (const program of [this.fillProgram, this.fillPickingProgram, this.edgeProgram, this.edgePickingProgram]) {
        const locs: Record<string, WebGLUniformLocation | null> = {}
        for (const name of uniformNames) {
          locs[name] = gl.getUniformLocation(program, name)
        }
        this.uniformCache.set(program, locs)
      }

      // Fill template: TRIANGLES with a_side = 0 (left) or 1 (right)
      const fillTemplateData = new Float32Array(FILL_VERTICES_PER_INSTANCE * 2)
      for (let s = 0; s < SEGMENTS; s++) {
        const t0 = s / SEGMENTS
        const t1 = (s + 1) / SEGMENTS
        const base = s * 12
        // Triangle 1: left@t0, right@t0, left@t1
        fillTemplateData[base + 0] = t0; fillTemplateData[base + 1] = 0
        fillTemplateData[base + 2] = t0; fillTemplateData[base + 3] = 1
        fillTemplateData[base + 4] = t1; fillTemplateData[base + 5] = 0
        // Triangle 2: left@t1, right@t0, right@t1
        fillTemplateData[base + 6] = t1; fillTemplateData[base + 7] = 0
        fillTemplateData[base + 8] = t0; fillTemplateData[base + 9] = 1
        fillTemplateData[base + 10] = t1; fillTemplateData[base + 11] = 1
      }
      this.fillTemplateBuffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, this.fillTemplateBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, fillTemplateData, gl.STATIC_DRAW)

      // Edge template: TRIANGLE_STRIP with a_side = -1 or +1
      const edgeTemplateData = new Float32Array(EDGE_VERTICES_PER_INSTANCE * 2)
      for (let i = 0; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS
        const base = i * 4
        edgeTemplateData[base + 0] = t
        edgeTemplateData[base + 1] = 1
        edgeTemplateData[base + 2] = t
        edgeTemplateData[base + 3] = -1
      }
      this.edgeTemplateBuffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeTemplateBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, edgeTemplateData, gl.STATIC_DRAW)

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
  }

  private createBuffer(gl: WebGL2RenderingContext, data: Float32Array) {
    const buf = gl.createBuffer()!
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
  ) {
    const vao = gl.createVertexArray()!
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

    // Per-instance attributes
    const attrs: [string, WebGLBuffer][] = [
      ['a_x1', x1Buf],
      ['a_x2', x2Buf],
      ['a_x3', x3Buf],
      ['a_x4', x4Buf],
      ['a_featureId', featureIdBuf],
      ['a_isCurve', isCurveBuf],
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

    // Instance data arrays (shared by fill and edge passes)
    const x1s: number[] = []
    const x2s: number[] = []
    const x3s: number[] = []
    const x4s: number[] = []
    const colors: number[] = []
    const featureIds: number[] = []
    const isCurves: number[] = []

    const isCurve = drawCurves ? 1 : 0
    const bpPerPx0 = bpPerPxs[level]!
    const bpPerPx1 = bpPerPxs[level + 1]!
    const bpPerPxInv0 = 1 / bpPerPx0
    const bpPerPxInv1 = 1 / bpPerPx1

    for (let i = 0; i < featPositions.length; i++) {
      const feat = featPositions[i]!
      const { p11, p12, p21, p22, f, cigar } = feat
      const x11 = p11.offsetPx
      const x12 = p12.offsetPx
      const x21 = p21.offsetPx
      const x22 = p22.offsetPx
      const strand = f.get('strand') as number
      const featureId = i + 1

      if (cigar.length > 0 && drawCIGAR) {
        const s1 = strand
        const k1 = s1 === -1 ? x12 : x11
        const k2 = s1 === -1 ? x11 : x12
        const rev1 = k1 < k2 ? 1 : -1
        const rev2 = (x21 < x22 ? 1 : -1) * s1

        let cx1 = k1
        let cx2 = s1 === -1 ? x22 : x21
        let continuingFlag = false
        let px1 = 0
        let px2 = 0

        for (let j = 0; j < cigar.length; j += 2) {
          const len = +cigar[j]!
          const op = cigar[j + 1] as keyof typeof defaultCigarColors

          if (!continuingFlag) {
            px1 = cx1
            px2 = cx2
          }

          const d1 = len * bpPerPxInv0
          const d2 = len * bpPerPxInv1

          if (op === 'M' || op === '=' || op === 'X') {
            cx1 += d1 * rev1
            cx2 += d2 * rev2
          } else if (op === 'D' || op === 'N') {
            cx1 += d1 * rev1
          } else if (op === 'I') {
            cx2 += d2 * rev2
          }

          const isNotLast = j < cigar.length - 2
          if (
            Math.abs(cx1 - px1) <= 1 &&
            Math.abs(cx2 - px2) <= 1 &&
            isNotLast
          ) {
            continuingFlag = true
          } else {
            const letter = (continuingFlag && d1 > 1) || d2 > 1 ? op : 'M'
            continuingFlag = false

            if (drawCIGARMatchesOnly && letter !== 'M') {
              continue
            }

            const [cr, cg, cb, ca] = getCigarColor(letter, colorBy, colorFn, feat, i, alpha)
            x1s.push(px1)
            x2s.push(cx1)
            x3s.push(cx2)
            x4s.push(px2)
            colors.push(cr, cg, cb, ca)
            featureIds.push(featureId)
            isCurves.push(isCurve)

            if (drawLocationMarkers) {
              addLocationMarkerInstances(
                x1s, x2s, x3s, x4s, colors, featureIds, isCurves,
                px1, cx1, cx2, px2, featureId, isCurve,
              )
            }
          }
        }
      } else {
        const [cr, cg, cb, ca] = colorFn(feat, i)
        x1s.push(x11)
        x2s.push(x12)
        x3s.push(x22)
        x4s.push(x21)
        colors.push(cr, cg, cb, ca)
        featureIds.push(featureId)
        isCurves.push(isCurve)

        if (drawLocationMarkers) {
          addLocationMarkerInstances(
            x1s, x2s, x3s, x4s, colors, featureIds, isCurves,
            x11, x12, x22, x21, featureId, isCurve,
          )
        }
      }
    }

    // Upload instance buffers (shared by all 4 VAOs)
    this.instanceCount = x1s.length
    if (this.instanceCount > 0) {
      const x1Buf = this.createBuffer(gl, new Float32Array(x1s))
      const x2Buf = this.createBuffer(gl, new Float32Array(x2s))
      const x3Buf = this.createBuffer(gl, new Float32Array(x3s))
      const x4Buf = this.createBuffer(gl, new Float32Array(x4s))
      const colorBuf = this.createBuffer(gl, new Float32Array(colors))
      const featureIdBuf = this.createBuffer(gl, new Float32Array(featureIds))
      const isCurveBuf = this.createBuffer(gl, new Float32Array(isCurves))

      this.fillVao = this.setupInstancedVao(
        gl, this.fillProgram!, this.fillTemplateBuffer!,
        x1Buf, x2Buf, x3Buf, x4Buf, colorBuf, featureIdBuf, isCurveBuf,
      )
      this.fillPickingVao = this.setupInstancedVao(
        gl, this.fillPickingProgram!, this.fillTemplateBuffer!,
        x1Buf, x2Buf, x3Buf, x4Buf, colorBuf, featureIdBuf, isCurveBuf,
      )
      this.edgeVao = this.setupInstancedVao(
        gl, this.edgeProgram!, this.edgeTemplateBuffer!,
        x1Buf, x2Buf, x3Buf, x4Buf, colorBuf, featureIdBuf, isCurveBuf,
      )
      this.edgePickingVao = this.setupInstancedVao(
        gl, this.edgePickingProgram!, this.edgeTemplateBuffer!,
        x1Buf, x2Buf, x3Buf, x4Buf, colorBuf, featureIdBuf, isCurveBuf,
      )
    }
  }

  render(offset0: number, offset1: number, height: number, skipEdges = false) {
    if (!this.gl || !this.canvas) {
      return
    }
    const gl = this.gl

    gl.clear(gl.COLOR_BUFFER_BIT)

    // Draw fills (instanced)
    if (this.fillVao && this.instanceCount > 0) {
      gl.useProgram(this.fillProgram)
      gl.bindVertexArray(this.fillVao)
      this.setUniforms(gl, this.fillProgram!, offset0, offset1, height)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, FILL_VERTICES_PER_INSTANCE, this.instanceCount)
    }

    // Draw AA edges on top (skipped during scroll for performance)
    if (!skipEdges && this.edgeVao && this.instanceCount > 0) {
      gl.useProgram(this.edgeProgram)
      gl.bindVertexArray(this.edgeVao)
      this.setUniforms(gl, this.edgeProgram!, offset0, offset1, height)
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        EDGE_VERTICES_PER_INSTANCE,
        this.instanceCount,
      )
    }

    gl.bindVertexArray(null)

    this.lastOffset0 = offset0
    this.lastOffset1 = offset1
    this.lastHeight = height
    this.pickingDirty = true
  }

  renderPicking(offset0: number, offset1: number, height: number) {
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
      this.setUniforms(gl, this.fillPickingProgram!, offset0, offset1, height)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, FILL_VERTICES_PER_INSTANCE, this.instanceCount)
    }

    // Draw edges for picking (instanced)
    if (this.edgePickingVao && this.instanceCount > 0) {
      gl.useProgram(this.edgePickingProgram)
      gl.bindVertexArray(this.edgePickingVao)
      this.setUniforms(gl, this.edgePickingProgram!, offset0, offset1, height)
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        EDGE_VERTICES_PER_INSTANCE,
        this.instanceCount,
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
    offset0: number,
    offset1: number,
    height: number,
  ) {
    const locs = this.uniformCache.get(program)!
    gl.uniform2f(locs.u_resolution!, this.width, this.height)
    gl.uniform1f(locs.u_height!, height)
    gl.uniform1f(locs.u_offset0!, offset0)
    gl.uniform1f(locs.u_offset1!, offset1)
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
      this.renderPicking(this.lastOffset0, this.lastOffset1, this.lastHeight)
      this.pickingDirty = false
    }

    const gl = this.gl
    const dpr = this.devicePixelRatio
    const canvasX = Math.floor(x * dpr)
    const canvasY = Math.floor(y * dpr)
    const canvasHeight = this.canvas.height

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFramebuffer)
    gl.readPixels(canvasX, canvasHeight - canvasY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pickingPixel)
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
  const isInsertionOrDeletion = letter === 'I' || letter === 'D' || letter === 'N'

  if (!isInsertionOrDeletion) {
    return colorFn(feat, index)
  }

  const scheme = colorBy === 'strand'
    ? colorSchemes.strand
    : colorSchemes.default
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
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
  featureId: number,
  isCurve: number,
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
      return strand === -1
        ? [0, 0, 1, alpha]
        : [1, 0, 0, alpha]
    }
  }

  if (colorBy === 'query') {
    const colorCache = new Map<string, [number, number, number, number]>()
    return (f: FeatPos) => {
      const name = (f.f.get('refName') as string) || ''
      if (!colorCache.has(name)) {
        const hash = hashString(name)
        const [r, g, b] = category10Normalized[hash % category10Normalized.length]!
        colorCache.set(name, [r, g, b, alpha])
      }
      return colorCache.get(name)!
    }
  }

  // Default: red
  return () => [1, 0, 0, alpha]
}
