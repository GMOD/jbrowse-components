import { category10 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

import { colorSchemes } from './drawSyntenyUtils.ts'

import type { defaultCigarColors } from './drawSyntenyUtils.ts'
import type { FeatPos } from './model.ts'

// Number of segments for bezier ribbon tessellation
const CURVE_SEGMENTS = 32

function cssColorToNormalized(color: string): [number, number, number, number] {
  const { r, g, b, a } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255, a]
}

// Vertex shader for synteny ribbons using ribbon extrusion approach
// Geometry is stored in "offset pixels" (pre-computed from bp coordinates)
// Transforms (scroll offsets) are applied via uniforms on the GPU
// Each synteny feature is drawn as a ribbon along its left and right edges
const VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-vertex (from template buffer, shared across all instances)
in float a_t;     // 0.0 to 1.0 parameter along the curve
in float a_side;  // -1.0 (left edge) or +1.0 (right edge)

// Per-instance attributes
in float a_x1;        // Left edge top X in offsetPx
in float a_x2;        // Right edge top X in offsetPx
in float a_x3;        // Right edge bottom X in offsetPx
in float a_x4;        // Left edge bottom X in offsetPx
in vec4 a_color;      // RGBA color (normalized 0-1)
in float a_featureId; // Feature ID for picking
in float a_isCurve;   // 0 = straight, 1 = bezier curve

// Uniforms for transforms
uniform vec2 u_resolution;
uniform float u_height;
uniform float u_offset0;
uniform float u_offset1;

// Outputs
out vec4 v_color;
out float v_dist;
flat out float v_featureId;

// Evaluate position along the left or right edge at parameter t
// For straight: linear interpolation
// For curved: bezier interpolation with control points at midpoint Y
vec2 evalEdge(float t, float topX, float bottomX, float isCurve) {
  float offset0 = u_offset0;
  float offset1 = u_offset1;

  if (isCurve > 0.5) {
    // Cubic bezier: P0=(topX, 0), P1=(topX, mid), P2=(bottomX, mid), P3=(bottomX, height)
    float mt = 1.0 - t;
    float mt2 = mt * mt;
    float mt3 = mt2 * mt;
    float t2 = t * t;
    float t3 = t2 * t;
    float mid = u_height * 0.5;

    float x = mt3 * topX + 3.0 * mt2 * t * topX + 3.0 * mt * t2 * bottomX + t3 * bottomX;
    float y = mt3 * 0.0 + 3.0 * mt2 * t * mid + 3.0 * mt * t2 * mid + t3 * u_height;

    // Interpolate offset based on y position
    float yFrac = y / u_height;
    float offset = mix(offset0, offset1, yFrac);
    return vec2(x - offset, y);
  }

  // Straight line
  float y = t * u_height;
  float x = mix(topX, bottomX, t);
  float offset = mix(offset0, offset1, t);
  return vec2(x - offset, y);
}

void main() {
  // Determine which edge based on a_side
  float topX = mix(a_x1, a_x2, step(0.0, a_side));
  float bottomX = mix(a_x4, a_x3, step(0.0, a_side));

  vec2 pos = evalEdge(a_t, topX, bottomX, a_isCurve);

  // Compute tangent via finite differences for extrusion
  float eps = 1.0 / float(${CURVE_SEGMENTS});
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

  // Extrude outward by half line width + AA margin
  // The 0.5 extra pixel is the anti-aliasing margin
  float halfWidth = 0.5 + 0.5;
  pos += normal * halfWidth * a_side;

  // Convert from pixel coordinates to clip space
  vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);

  v_dist = a_side * halfWidth;
  v_color = a_color;
  v_featureId = a_featureId;
}
`

// Fragment shader with analytical anti-aliasing via smoothstep + fwidth
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
  // Output premultiplied alpha for correct canvas compositing
  fragColor = vec4(v_color.rgb * finalAlpha, finalAlpha);
}
`

// Fragment shader for picking - encodes feature ID as color
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

// Vertex shader for filled trapezoid/bezier regions (the ribbon fill)
const FILL_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position_x;
in float a_position_y;
in float a_row;
in vec4 a_color;
in float a_featureId;

uniform vec2 u_resolution;
uniform float u_height;
uniform float u_offset0;
uniform float u_offset1;

out vec4 v_color;
flat out float v_featureId;

void main() {
  float offset = mix(u_offset0, u_offset1, a_row);
  float x = a_position_x - offset;
  float y = a_position_y * u_height;

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
  // Output premultiplied alpha for correct canvas compositing
  outColor = vec4(v_color.rgb * v_color.a, v_color.a);
}
`

const FILL_PICKING_FRAGMENT_SHADER = `#version 300 es
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

export class SyntenyWebGLRenderer {
  private gl: WebGL2RenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private width = 0
  private height = 0
  private devicePixelRatio = 1

  // Fill programs (for filled trapezoids/bezier regions)
  private fillProgram: WebGLProgram | null = null
  private fillPickingProgram: WebGLProgram | null = null
  private fillVao: WebGLVertexArrayObject | null = null
  private fillPickingVao: WebGLVertexArrayObject | null = null
  private fillVertexCount = 0

  // Edge programs (for anti-aliased edges using ribbon extrusion)
  private edgeProgram: WebGLProgram | null = null
  private edgePickingProgram: WebGLProgram | null = null
  private edgeVao: WebGLVertexArrayObject | null = null
  private edgePickingVao: WebGLVertexArrayObject | null = null
  private edgeInstanceCount = 0
  private templateBuffer: WebGLBuffer | null = null

  // Picking framebuffer
  private pickingFramebuffer: WebGLFramebuffer | null = null
  private pickingTexture: WebGLTexture | null = null

  // All allocated buffers for cleanup
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
      // Create fill programs
      this.fillProgram = createProgram(gl, FILL_VERTEX_SHADER, FILL_FRAGMENT_SHADER)
      this.fillPickingProgram = createProgram(gl, FILL_VERTEX_SHADER, FILL_PICKING_FRAGMENT_SHADER)

      // Create edge programs (ribbon extrusion with AA)
      this.edgeProgram = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)
      this.edgePickingProgram = createProgram(gl, VERTEX_SHADER, PICKING_FRAGMENT_SHADER)

      // Create template buffer for edge ribbon
      // For each t value along the curve, two vertices: side=+1 and side=-1
      const numVertices = (CURVE_SEGMENTS + 1) * 2
      const templateData = new Float32Array(numVertices * 2)
      for (let i = 0; i <= CURVE_SEGMENTS; i++) {
        const t = i / CURVE_SEGMENTS
        const base = i * 4
        templateData[base + 0] = t
        templateData[base + 1] = 1
        templateData[base + 2] = t
        templateData[base + 3] = -1
      }
      this.templateBuffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, templateData, gl.STATIC_DRAW)

      // Create picking framebuffer
      this.pickingFramebuffer = gl.createFramebuffer()!
      this.pickingTexture = gl.createTexture()!
      this.resizePickingBuffer(canvas.width, canvas.height)

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
    this.devicePixelRatio = this.canvas.width / width
    this.width = width
    this.height = height
    this.resizePickingBuffer(this.canvas.width, this.canvas.height)
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
    this.fillVertexCount = 0
    this.edgeInstanceCount = 0
  }

  private createBuffer(gl: WebGL2RenderingContext, data: Float32Array) {
    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    this.allocatedBuffers.push(buf)
    return buf
  }

  private setupFillVao(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    positionXBuf: WebGLBuffer,
    positionYBuf: WebGLBuffer,
    rowBuf: WebGLBuffer,
    colorBuf: WebGLBuffer,
    featureIdBuf: WebGLBuffer,
  ) {
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)

    const posXLoc = gl.getAttribLocation(program, 'a_position_x')
    gl.bindBuffer(gl.ARRAY_BUFFER, positionXBuf)
    gl.enableVertexAttribArray(posXLoc)
    gl.vertexAttribPointer(posXLoc, 1, gl.FLOAT, false, 0, 0)

    const posYLoc = gl.getAttribLocation(program, 'a_position_y')
    gl.bindBuffer(gl.ARRAY_BUFFER, positionYBuf)
    gl.enableVertexAttribArray(posYLoc)
    gl.vertexAttribPointer(posYLoc, 1, gl.FLOAT, false, 0, 0)

    const rowLoc = gl.getAttribLocation(program, 'a_row')
    gl.bindBuffer(gl.ARRAY_BUFFER, rowBuf)
    gl.enableVertexAttribArray(rowLoc)
    gl.vertexAttribPointer(rowLoc, 1, gl.FLOAT, false, 0, 0)

    const colorLoc = gl.getAttribLocation(program, 'a_color')
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf)
    gl.enableVertexAttribArray(colorLoc)
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0)

    const featureIdLoc = gl.getAttribLocation(program, 'a_featureId')
    gl.bindBuffer(gl.ARRAY_BUFFER, featureIdBuf)
    gl.enableVertexAttribArray(featureIdLoc)
    gl.vertexAttribPointer(featureIdLoc, 1, gl.FLOAT, false, 0, 0)

    gl.bindVertexArray(null)
    return vao
  }

  private setupEdgeVao(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
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

    // Build fill geometry (triangulated trapezoids/bezier regions)
    const fillPosX: number[] = []
    const fillPosY: number[] = []
    const fillRows: number[] = []
    const fillColors: number[] = []
    const fillFeatureIds: number[] = []

    // Build edge instances (for AA edges along left and right borders)
    const edgeX1: number[] = []
    const edgeX2: number[] = []
    const edgeX3: number[] = []
    const edgeX4: number[] = []
    const edgeColors: number[] = []
    const edgeFeatureIds: number[] = []
    const edgeIsCurve: number[] = []

    const segments = drawCurves ? CURVE_SEGMENTS : 1
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
            addTrapezoid(
              fillPosX, fillPosY, fillRows, fillColors, fillFeatureIds,
              px1, cx1, cx2, px2, cr, cg, cb, ca, featureId, segments, drawCurves,
            )

            // Add edge instances for AA
            edgeX1.push(px1)
            edgeX2.push(cx1)
            edgeX3.push(cx2)
            edgeX4.push(px2)
            edgeColors.push(cr, cg, cb, ca)
            edgeFeatureIds.push(featureId)
            edgeIsCurve.push(drawCurves ? 1 : 0)

            if (drawLocationMarkers) {
              addLocationMarkerGeometry(
                fillPosX, fillPosY, fillRows, fillColors, fillFeatureIds,
                px1, cx1, cx2, px2, featureId, segments, drawCurves, bpPerPx0, bpPerPx1,
              )
            }
          }
        }
      } else {
        const [cr, cg, cb, ca] = colorFn(feat, i)
        addTrapezoid(
          fillPosX, fillPosY, fillRows, fillColors, fillFeatureIds,
          x11, x12, x22, x21, cr, cg, cb, ca, featureId, segments, drawCurves,
        )

        // Add edge instances for AA
        edgeX1.push(x11)
        edgeX2.push(x12)
        edgeX3.push(x22)
        edgeX4.push(x21)
        edgeColors.push(cr, cg, cb, ca)
        edgeFeatureIds.push(featureId)
        edgeIsCurve.push(drawCurves ? 1 : 0)

        if (drawLocationMarkers) {
          addLocationMarkerGeometry(
            fillPosX, fillPosY, fillRows, fillColors, fillFeatureIds,
            x11, x12, x22, x21, featureId, segments, drawCurves, bpPerPx0, bpPerPx1,
          )
        }
      }
    }

    // Upload fill geometry
    this.fillVertexCount = fillPosX.length
    if (this.fillVertexCount > 0) {
      const positionXBuf = this.createBuffer(gl, new Float32Array(fillPosX))
      const positionYBuf = this.createBuffer(gl, new Float32Array(fillPosY))
      const rowBuf = this.createBuffer(gl, new Float32Array(fillRows))
      const colorBuf = this.createBuffer(gl, new Float32Array(fillColors))
      const featureIdBuf = this.createBuffer(gl, new Float32Array(fillFeatureIds))

      this.fillVao = this.setupFillVao(
        gl, this.fillProgram!, positionXBuf, positionYBuf, rowBuf, colorBuf, featureIdBuf,
      )
      this.fillPickingVao = this.setupFillVao(
        gl, this.fillPickingProgram!, positionXBuf, positionYBuf, rowBuf, colorBuf, featureIdBuf,
      )
    }

    // Upload edge instances
    this.edgeInstanceCount = edgeX1.length
    if (this.edgeInstanceCount > 0) {
      const x1Buf = this.createBuffer(gl, new Float32Array(edgeX1))
      const x2Buf = this.createBuffer(gl, new Float32Array(edgeX2))
      const x3Buf = this.createBuffer(gl, new Float32Array(edgeX3))
      const x4Buf = this.createBuffer(gl, new Float32Array(edgeX4))
      const colorBuf = this.createBuffer(gl, new Float32Array(edgeColors))
      const featureIdBuf = this.createBuffer(gl, new Float32Array(edgeFeatureIds))
      const isCurveBuf = this.createBuffer(gl, new Float32Array(edgeIsCurve))

      this.edgeVao = this.setupEdgeVao(
        gl, this.edgeProgram!, x1Buf, x2Buf, x3Buf, x4Buf, colorBuf, featureIdBuf, isCurveBuf,
      )
      this.edgePickingVao = this.setupEdgeVao(
        gl, this.edgePickingProgram!, x1Buf, x2Buf, x3Buf, x4Buf, colorBuf, featureIdBuf, isCurveBuf,
      )
    }
  }

  render(offset0: number, offset1: number, height: number) {
    if (!this.gl || !this.canvas) {
      return
    }
    const gl = this.gl
    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    // Draw fills
    if (this.fillVao && this.fillVertexCount > 0) {
      gl.useProgram(this.fillProgram)
      gl.bindVertexArray(this.fillVao)
      this.setFillUniforms(gl, this.fillProgram!, offset0, offset1, height)
      gl.drawArrays(gl.TRIANGLES, 0, this.fillVertexCount)
    }

    // Draw AA edges on top
    if (this.edgeVao && this.edgeInstanceCount > 0) {
      gl.useProgram(this.edgeProgram)
      gl.bindVertexArray(this.edgeVao)
      this.setEdgeUniforms(gl, this.edgeProgram!, offset0, offset1, height)
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        (CURVE_SEGMENTS + 1) * 2,
        this.edgeInstanceCount,
      )
    }

    gl.bindVertexArray(null)
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

    // Draw fills for picking
    if (this.fillPickingVao && this.fillVertexCount > 0) {
      gl.useProgram(this.fillPickingProgram)
      gl.bindVertexArray(this.fillPickingVao)
      this.setFillUniforms(gl, this.fillPickingProgram!, offset0, offset1, height)
      gl.drawArrays(gl.TRIANGLES, 0, this.fillVertexCount)
    }

    // Draw edges for picking
    if (this.edgePickingVao && this.edgeInstanceCount > 0) {
      gl.useProgram(this.edgePickingProgram)
      gl.bindVertexArray(this.edgePickingVao)
      this.setEdgeUniforms(gl, this.edgePickingProgram!, offset0, offset1, height)
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        (CURVE_SEGMENTS + 1) * 2,
        this.edgeInstanceCount,
      )
    }

    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private setFillUniforms(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    offset0: number,
    offset1: number,
    height: number,
  ) {
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), this.width, this.height)
    gl.uniform1f(gl.getUniformLocation(program, 'u_height'), height)
    gl.uniform1f(gl.getUniformLocation(program, 'u_offset0'), offset0)
    gl.uniform1f(gl.getUniformLocation(program, 'u_offset1'), offset1)
  }

  private setEdgeUniforms(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    offset0: number,
    offset1: number,
    height: number,
  ) {
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), this.width, this.height)
    gl.uniform1f(gl.getUniformLocation(program, 'u_height'), height)
    gl.uniform1f(gl.getUniformLocation(program, 'u_offset0'), offset0)
    gl.uniform1f(gl.getUniformLocation(program, 'u_offset1'), offset1)
  }

  pick(x: number, y: number) {
    if (!this.gl || !this.canvas) {
      return -1
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
    return this.fillVertexCount > 0 || this.edgeInstanceCount > 0
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

// Add a trapezoid (or bezier ribbon) to the fill geometry arrays
function addTrapezoid(
  posX: number[],
  posY: number[],
  rows: number[],
  colors: number[],
  featureIds: number[],
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
  r: number,
  g: number,
  b: number,
  a: number,
  featureId: number,
  segments: number,
  drawCurves: boolean,
) {
  if (drawCurves) {
    // Tessellate bezier curves into triangle strips
    for (let s = 0; s < segments; s++) {
      const t0 = s / segments
      const t1 = (s + 1) / segments

      // Bezier interpolation coefficients for t0
      const t0_2 = t0 * t0
      const t0_3 = t0_2 * t0
      const mt0 = 1 - t0
      const mt0_2 = mt0 * mt0
      const mt0_3 = mt0_2 * mt0

      // Bezier interpolation coefficients for t1
      const t1_2 = t1 * t1
      const t1_3 = t1_2 * t1
      const mt1 = 1 - t1
      const mt1_2 = mt1 * mt1
      const mt1_3 = mt1_2 * mt1

      // Left edge: bezier from topLeft(y=0) through mid to bottomLeft(y=1)
      // Control points: P0=(topLeft,0), P1=(topLeft,0.5), P2=(bottomLeft,0.5), P3=(bottomLeft,1)
      const lx0 = mt0_3 * topLeft + 3 * mt0_2 * t0 * topLeft + 3 * mt0 * t0_2 * bottomLeft + t0_3 * bottomLeft
      const ly0 = mt0_3 * 0 + 3 * mt0_2 * t0 * 0.5 + 3 * mt0 * t0_2 * 0.5 + t0_3 * 1

      const lx1 = mt1_3 * topLeft + 3 * mt1_2 * t1 * topLeft + 3 * mt1 * t1_2 * bottomLeft + t1_3 * bottomLeft
      const ly1 = mt1_3 * 0 + 3 * mt1_2 * t1 * 0.5 + 3 * mt1 * t1_2 * 0.5 + t1_3 * 1

      // Right edge: bezier from topRight(y=0) through mid to bottomRight(y=1)
      const rx0 = mt0_3 * topRight + 3 * mt0_2 * t0 * topRight + 3 * mt0 * t0_2 * bottomRight + t0_3 * bottomRight
      const rx1 = mt1_3 * topRight + 3 * mt1_2 * t1 * topRight + 3 * mt1 * t1_2 * bottomRight + t1_3 * bottomRight

      const row0 = t0
      const row1 = t1

      // Two triangles per segment
      posX.push(lx0, rx0, lx1)
      posY.push(ly0, ly0, ly1)
      rows.push(row0, row0, row1)

      posX.push(lx1, rx0, rx1)
      posY.push(ly1, ly0, ly1)
      rows.push(row1, row0, row1)

      for (let v = 0; v < 6; v++) {
        colors.push(r, g, b, a)
        featureIds.push(featureId)
      }
    }
  } else {
    // Simple straight trapezoid - 2 triangles
    posX.push(topLeft, topRight, bottomRight)
    posY.push(0, 0, 1)
    rows.push(0, 0, 1)

    posX.push(topLeft, bottomRight, bottomLeft)
    posY.push(0, 1, 1)
    rows.push(0, 1, 1)

    for (let v = 0; v < 6; v++) {
      colors.push(r, g, b, a)
      featureIds.push(featureId)
    }
  }
}

// Add location marker geometry (thin semi-transparent lines across large blocks)
function addLocationMarkerGeometry(
  posX: number[],
  posY: number[],
  rows: number[],
  colors: number[],
  featureIds: number[],
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
  featureId: number,
  segments: number,
  drawCurves: boolean,
  bpPerPx0: number,
  bpPerPx1: number,
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

  // Semi-transparent dark lines
  const mr = 0
  const mg = 0
  const mb = 0
  const ma = 0.25
  const lineHalfWidth = 0.25 // Very thin

  for (let step = 0; step < numMarkers; step++) {
    const t = step / numMarkers
    const markerTopX = topLeft + (topRight - topLeft) * t
    const markerBottomX = bottomLeft + (bottomRight - bottomLeft) * t

    // Draw each marker as a thin trapezoid
    addTrapezoid(
      posX, posY, rows, colors, featureIds,
      markerTopX - lineHalfWidth, markerTopX + lineHalfWidth,
      markerBottomX + lineHalfWidth, markerBottomX - lineHalfWidth,
      mr, mg, mb, ma, featureId, segments, drawCurves,
    )
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
      // Red for positive, blue for negative - matching Canvas 2D
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
