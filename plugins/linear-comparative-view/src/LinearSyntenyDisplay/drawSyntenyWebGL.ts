import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

// WebGL Memory Tracker
class WebGLMemoryTracker {
  private buffers = new Map<WebGLBuffer, { size: number; label: string }>()
  private textures = new Map<
    WebGLTexture,
    { width: number; height: number; format: string }
  >()
  private vaos = new Set<WebGLVertexArrayObject>()
  private programs = new Set<WebGLProgram>()

  trackBuffer(buffer: WebGLBuffer, size: number, label: string) {
    this.buffers.set(buffer, { size, label })
    console.debug(
      `[WebGL Memory] Allocated buffer "${label}": ${this.formatBytes(size)}`,
    )
    this.logTotalMemory()
  }

  untrackBuffer(buffer: WebGLBuffer) {
    const info = this.buffers.get(buffer)
    if (info) {
      console.debug(
        `[WebGL Memory] Deleted buffer "${info.label}": ${this.formatBytes(info.size)}`,
      )
      this.buffers.delete(buffer)
      this.logTotalMemory()
    }
  }

  trackTexture(
    texture: WebGLTexture,
    width: number,
    height: number,
    format: string,
  ) {
    this.textures.set(texture, { width, height, format })
    const size = width * height * 4
    console.debug(
      `[WebGL Memory] Allocated texture ${width}x${height} (${format}): ${this.formatBytes(size)}`,
    )
    this.logTotalMemory()
  }

  untrackTexture(texture: WebGLTexture) {
    const info = this.textures.get(texture)
    if (info) {
      const size = info.width * info.height * 4
      console.debug(
        `[WebGL Memory] Deleted texture ${info.width}x${info.height} (${info.format}): ${this.formatBytes(size)}`,
      )
      this.textures.delete(texture)
      this.logTotalMemory()
    }
  }

  trackVAO(vao: WebGLVertexArrayObject) {
    this.vaos.add(vao)
    console.debug(`[WebGL Memory] Created VAO (total: ${this.vaos.size})`)
  }

  untrackVAO(vao: WebGLVertexArrayObject) {
    if (this.vaos.delete(vao)) {
      console.debug(`[WebGL Memory] Deleted VAO (total: ${this.vaos.size})`)
    }
  }

  trackProgram(program: WebGLProgram) {
    this.programs.add(program)
    console.debug(
      `[WebGL Memory] Created program (total: ${this.programs.size})`,
    )
  }

  untrackProgram(program: WebGLProgram) {
    if (this.programs.delete(program)) {
      console.debug(
        `[WebGL Memory] Deleted program (total: ${this.programs.size})`,
      )
    }
  }

  getTotalBufferMemory() {
    let total = 0
    for (const { size } of this.buffers.values()) {
      total += size
    }
    return total
  }

  getTotalTextureMemory() {
    let total = 0
    for (const { width, height } of this.textures.values()) {
      total += width * height * 4
    }
    return total
  }

  getTotalMemory() {
    return this.getTotalBufferMemory() + this.getTotalTextureMemory()
  }

  logTotalMemory() {
    const bufferMem = this.getTotalBufferMemory()
    const textureMem = this.getTotalTextureMemory()
    const total = bufferMem + textureMem
    console.debug(
      `[WebGL Memory] Total: ${this.formatBytes(total)} (Buffers: ${this.formatBytes(bufferMem)}, Textures: ${this.formatBytes(textureMem)}, VAOs: ${this.vaos.size}, Programs: ${this.programs.size})`,
    )
  }

  logDetailedReport() {
    console.group('[WebGL Memory] Detailed Report')
    console.log(`Total Memory: ${this.formatBytes(this.getTotalMemory())}`)
    console.log(`Buffers (${this.buffers.size}):`)
    for (const [, info] of this.buffers) {
      console.log(`  - ${info.label}: ${this.formatBytes(info.size)}`)
    }
    console.log(`Textures (${this.textures.size}):`)
    for (const [, info] of this.textures) {
      const size = info.width * info.height * 4
      console.log(
        `  - ${info.width}x${info.height} (${info.format}): ${this.formatBytes(size)}`,
      )
    }
    console.log(`VAOs: ${this.vaos.size}`)
    console.log(`Programs: ${this.programs.size}`)
    console.groupEnd()
  }

  private formatBytes(bytes: number) {
    if (bytes === 0) {
      return '0 Bytes'
    }
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  clear() {
    this.buffers.clear()
    this.textures.clear()
    this.vaos.clear()
    this.programs.clear()
  }
}

// Segment counts for straight lines (no bezier needed, just a quad)
const STRAIGHT_FILL_SEGMENTS = 1
const STRAIGHT_EDGE_SEGMENTS = 1
// Segment counts for bezier curves
const CURVE_FILL_SEGMENTS = 16
const CURVE_EDGE_SEGMENTS = 8

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
in float a_padTop;
in float a_padBottom;

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
  if (u_minAlignmentLength > 0.0 && a_queryTotalLength < u_minAlignmentLength) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_color = vec4(0.0);
    v_featureId = 0.0;
    return;
  }

  float topMinX = (min(a_x1.x, a_x2.x) - u_adjOff0.x) * u_scale0 - a_padTop * (u_scale0 - 1.0);
  float topMaxX = (max(a_x1.x, a_x2.x) - u_adjOff0.x) * u_scale0 - a_padTop * (u_scale0 - 1.0);
  float botMinX = (min(a_x3.x, a_x4.x) - u_adjOff1.x) * u_scale1 - a_padBottom * (u_scale1 - 1.0);
  float botMaxX = (max(a_x3.x, a_x4.x) - u_adjOff1.x) * u_scale1 - a_padBottom * (u_scale1 - 1.0);
  if (topMaxX < -u_maxOffScreenPx || topMinX > u_resolution.x + u_maxOffScreenPx ||
      botMaxX < -u_maxOffScreenPx || botMinX > u_resolution.x + u_maxOffScreenPx) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_color = vec4(0.0);
    v_featureId = 0.0;
    return;
  }

  vec2 topXHP = mix(a_x1, a_x2, a_side);
  vec2 bottomXHP = mix(a_x4, a_x3, a_side);
  float screenTopX = hpDiff(topXHP, u_adjOff0) * u_scale0 - a_padTop * (u_scale0 - 1.0);
  float screenBottomX = hpDiff(bottomXHP, u_adjOff1) * u_scale1 - a_padBottom * (u_scale1 - 1.0);

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
uniform float u_forceOpaque;
uniform float u_alpha;

out vec4 outColor;

void main() {
  if (u_forceOpaque > 0.5) {
    outColor = vec4(v_color.rgb, 1.0);
  } else {
    outColor = vec4(v_color.rgb, v_color.a * u_alpha);
  }
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
in float a_padTop;
in float a_padBottom;

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

  float topMinX = (min(a_x1.x, a_x2.x) - u_adjOff0.x) * u_scale0 - a_padTop * (u_scale0 - 1.0);
  float topMaxX = (max(a_x1.x, a_x2.x) - u_adjOff0.x) * u_scale0 - a_padTop * (u_scale0 - 1.0);
  float botMinX = (min(a_x3.x, a_x4.x) - u_adjOff1.x) * u_scale1 - a_padBottom * (u_scale1 - 1.0);
  float botMaxX = (max(a_x3.x, a_x4.x) - u_adjOff1.x) * u_scale1 - a_padBottom * (u_scale1 - 1.0);
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
  float screenTopX = hpDiff(topXHP, u_adjOff0) * u_scale0 - a_padTop * (u_scale0 - 1.0);
  float screenBottomX = hpDiff(bottomXHP, u_adjOff1) * u_scale1 - a_padBottom * (u_scale1 - 1.0);

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
uniform float u_alpha;

out vec4 fragColor;

void main() {
  float halfWidth = 0.5;
  float d = abs(v_dist);
  float aa = fwidth(v_dist);
  float edgeAlpha = 1.0 - smoothstep(halfWidth - aa * 0.5, halfWidth + aa, d);
  fragColor = vec4(v_color.rgb, v_color.a * u_alpha * edgeAlpha);
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
  label?: string,
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

  if (label) {
    console.debug(`[WebGL Synteny] Created program: ${label}`)
  }

  return program
}

export class SyntenyWebGLRenderer {
  private gl: WebGL2RenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private width = 0
  private height = 0
  private devicePixelRatio = 1
  private memoryTracker = new WebGLMemoryTracker()

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

  // Straight-line VAOs for fast scroll rendering (6 fill + 4 edge vertices
  // per instance vs 96+18 for curves — ~11x fewer vertices)
  private straightFillTemplateBuffer: WebGLBuffer | null = null
  private straightEdgeTemplateBuffer: WebGLBuffer | null = null
  private straightFillVao: WebGLVertexArrayObject | null = null
  private straightFillPickingVao: WebGLVertexArrayObject | null = null
  private straightEdgeVao: WebGLVertexArrayObject | null = null
  private straightEdgePickingVao: WebGLVertexArrayObject | null = null
  private straightFillVerticesPerInstance = 6
  private straightEdgeVerticesPerInstance = 4

  // All allocated buffers for cleanup
  private allocatedBuffers: WebGLBuffer[] = []
  private pickingPixel = new Uint8Array(4)

  init(canvas: HTMLCanvasElement) {
    console.log('[WebGL Synteny] Initializing WebGL context', {
      canvasSize: `${canvas.width}x${canvas.height}`,
      clientSize: `${canvas.clientWidth}x${canvas.clientHeight}`,
    })

    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
    })

    if (!gl) {
      console.warn('[WebGL Synteny] WebGL2 not supported')
      return false
    }

    console.log('[WebGL Synteny] WebGL2 context created successfully')

    this.canvas = canvas
    this.gl = gl
    this.devicePixelRatio = canvas.width / (canvas.clientWidth || canvas.width)
    this.width = canvas.clientWidth || canvas.width
    this.height = canvas.clientHeight || canvas.height

    console.debug('[WebGL Synteny] Device pixel ratio:', this.devicePixelRatio)

    try {
      this.fillProgram = createProgram(
        gl,
        FILL_VERTEX_SHADER,
        FILL_FRAGMENT_SHADER,
        'fillProgram',
      )
      this.fillPickingProgram = createProgram(
        gl,
        FILL_VERTEX_SHADER,
        PICKING_FRAGMENT_SHADER,
        'fillPickingProgram',
      )
      this.edgeProgram = createProgram(
        gl,
        EDGE_VERTEX_SHADER,
        EDGE_FRAGMENT_SHADER,
        'edgeProgram',
      )
      this.edgePickingProgram = createProgram(
        gl,
        EDGE_VERTEX_SHADER,
        PICKING_FRAGMENT_SHADER,
        'edgePickingProgram',
      )

      this.memoryTracker.trackProgram(this.fillProgram)
      this.memoryTracker.trackProgram(this.fillPickingProgram)
      this.memoryTracker.trackProgram(this.edgeProgram)
      this.memoryTracker.trackProgram(this.edgePickingProgram)

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
        'u_forceOpaque',
        'u_alpha',
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
      console.log('[WebGL Synteny] Created picking framebuffer')

      this.memoryTracker.logDetailedReport()

      // Log WebGL limits and capabilities
      this.logWebGLLimits(gl)

      // Set initial GL state - opaque white background (no alpha compositing)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(1, 1, 1, 1)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

      console.log('[WebGL Synteny] Initialization complete')
      return true
    } catch (e) {
      console.error('[WebGL Synteny] Initialization failed:', e)
      return false
    }
  }

  private logWebGLLimits(gl: WebGL2RenderingContext) {
    const limits = {
      MAX_TEXTURE_SIZE: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      MAX_RENDERBUFFER_SIZE: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      MAX_VERTEX_ATTRIBS: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      MAX_VARYING_VECTORS: gl.getParameter(gl.MAX_VARYING_VECTORS),
      MAX_VERTEX_UNIFORM_VECTORS: gl.getParameter(
        gl.MAX_VERTEX_UNIFORM_VECTORS,
      ),
      MAX_FRAGMENT_UNIFORM_VECTORS: gl.getParameter(
        gl.MAX_FRAGMENT_UNIFORM_VECTORS,
      ),
      MAX_COMBINED_TEXTURE_IMAGE_UNITS: gl.getParameter(
        gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS,
      ),
    }

    console.group('[WebGL Synteny] WebGL Limits')
    for (const [key, value] of Object.entries(limits)) {
      console.log(`${key}: ${value}`)
    }
    console.groupEnd()

    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) {
      console.log('[WebGL Synteny] GPU:', {
        vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
      })
    }
  }

  private resizePickingBuffer(canvasWidth: number, canvasHeight: number) {
    const gl = this.gl!
    console.debug(
      `[WebGL Synteny] Resizing picking buffer to ${canvasWidth}x${canvasHeight}`,
    )

    if (this.pickingTexture) {
      this.memoryTracker.untrackTexture(this.pickingTexture)
    }

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

    if (this.pickingTexture) {
      this.memoryTracker.trackTexture(
        this.pickingTexture,
        canvasWidth,
        canvasHeight,
        'RGBA picking',
      )
    }
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
    if (this.straightFillTemplateBuffer) {
      gl.deleteBuffer(this.straightFillTemplateBuffer)
    }
    if (this.straightEdgeTemplateBuffer) {
      gl.deleteBuffer(this.straightEdgeTemplateBuffer)
    }

    this.currentFillSegments = fillSegments
    this.currentEdgeSegments = edgeSegments
    this.fillVerticesPerInstance = fillSegments * 6
    this.edgeVerticesPerInstance = (edgeSegments + 1) * 2

    console.debug(
      `[WebGL Synteny] Rebuilding templates: fill segments=${fillSegments}, edge segments=${edgeSegments}`,
    )

    // Main (curve) templates
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
    this.memoryTracker.trackBuffer(
      this.fillTemplateBuffer,
      fillTemplateData.byteLength,
      'fillTemplate',
    )

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
    this.memoryTracker.trackBuffer(
      this.edgeTemplateBuffer,
      edgeTemplateData.byteLength,
      'edgeTemplate',
    )

    // Straight-line templates (1 segment = 6 fill vertices, 4 edge vertices)
    // Used during scroll for ~11x fewer vertices per instance
    this.straightFillVerticesPerInstance = 6
    this.straightEdgeVerticesPerInstance = 4

    const straightFillData = new Float32Array([
      0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1,
    ])
    this.straightFillTemplateBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.straightFillTemplateBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, straightFillData, gl.STATIC_DRAW)
    this.memoryTracker.trackBuffer(
      this.straightFillTemplateBuffer,
      straightFillData.byteLength,
      'straightFillTemplate',
    )

    const straightEdgeData = new Float32Array([0, 1, 0, -1, 1, 1, 1, -1])
    this.straightEdgeTemplateBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.straightEdgeTemplateBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, straightEdgeData, gl.STATIC_DRAW)
    this.memoryTracker.trackBuffer(
      this.straightEdgeTemplateBuffer,
      straightEdgeData.byteLength,
      'straightEdgeTemplate',
    )
  }

  resize(width: number, height: number) {
    if (!this.canvas || !this.gl) {
      return
    }
    if (this.width === width && this.height === height) {
      return
    }

    console.debug(
      `[WebGL Synteny] Resizing renderer: ${this.width}x${this.height} → ${width}x${height}`,
    )

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

    console.debug(
      `[WebGL Synteny] Cleaning up geometry (${this.allocatedBuffers.length} buffers, 8 VAOs)`,
    )

    if (this.fillVao) {
      this.memoryTracker.untrackVAO(this.fillVao)
      gl.deleteVertexArray(this.fillVao)
      this.fillVao = null
    }
    if (this.fillPickingVao) {
      this.memoryTracker.untrackVAO(this.fillPickingVao)
      gl.deleteVertexArray(this.fillPickingVao)
      this.fillPickingVao = null
    }
    if (this.edgeVao) {
      this.memoryTracker.untrackVAO(this.edgeVao)
      gl.deleteVertexArray(this.edgeVao)
      this.edgeVao = null
    }
    if (this.edgePickingVao) {
      this.memoryTracker.untrackVAO(this.edgePickingVao)
      gl.deleteVertexArray(this.edgePickingVao)
      this.edgePickingVao = null
    }
    if (this.straightFillVao) {
      this.memoryTracker.untrackVAO(this.straightFillVao)
      gl.deleteVertexArray(this.straightFillVao)
      this.straightFillVao = null
    }
    if (this.straightFillPickingVao) {
      this.memoryTracker.untrackVAO(this.straightFillPickingVao)
      gl.deleteVertexArray(this.straightFillPickingVao)
      this.straightFillPickingVao = null
    }
    if (this.straightEdgeVao) {
      this.memoryTracker.untrackVAO(this.straightEdgeVao)
      gl.deleteVertexArray(this.straightEdgeVao)
      this.straightEdgeVao = null
    }
    if (this.straightEdgePickingVao) {
      this.memoryTracker.untrackVAO(this.straightEdgePickingVao)
      gl.deleteVertexArray(this.straightEdgePickingVao)
      this.straightEdgePickingVao = null
    }
    for (const buf of this.allocatedBuffers) {
      this.memoryTracker.untrackBuffer(buf)
      gl.deleteBuffer(buf)
    }
    this.allocatedBuffers = []
    this.instanceCount = 0
    this.nonCigarInstanceCount = 0
  }

  private createBuffer(
    gl: WebGL2RenderingContext,
    data: Float32Array,
    label: string,
  ) {
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    this.allocatedBuffers.push(buf)
    this.memoryTracker.trackBuffer(buf, data.byteLength, label)
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
    padTopBuf: WebGLBuffer,
    padBottomBuf: WebGLBuffer,
  ) {
    const vao = gl.createVertexArray()
    this.memoryTracker.trackVAO(vao)
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
      ['a_padTop', padTopBuf],
      ['a_padBottom', padBottomBuf],
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

  uploadGeometry(data: SyntenyInstanceData, drawCurves: boolean) {
    if (!this.gl) {
      return
    }
    const gl = this.gl

    const totalDataBytes =
      data.x1.byteLength +
      data.x2.byteLength +
      data.x3.byteLength +
      data.x4.byteLength +
      data.colors.byteLength +
      data.featureIds.byteLength +
      data.isCurves.byteLength +
      data.queryTotalLengths.byteLength +
      data.padTops.byteLength +
      data.padBottoms.byteLength
    const totalDataMB = totalDataBytes / (1024 * 1024)

    console.log(
      `[WebGL Synteny] Uploading geometry: ${data.instanceCount} instances (${data.nonCigarInstanceCount} non-CIGAR)`,
    )
    console.debug(`[WebGL Synteny] Data sizes:`, {
      x1: data.x1.byteLength,
      x2: data.x2.byteLength,
      x3: data.x3.byteLength,
      x4: data.x4.byteLength,
      colors: data.colors.byteLength,
      featureIds: data.featureIds.byteLength,
      isCurves: data.isCurves.byteLength,
      queryTotalLengths: data.queryTotalLengths.byteLength,
      padTops: data.padTops.byteLength,
      padBottoms: data.padBottoms.byteLength,
      totalBytes: totalDataBytes,
      totalMB: totalDataMB.toFixed(2),
    })

    if (totalDataMB > 100) {
      console.warn(
        `[WebGL Synteny] WARNING: Uploading ${totalDataMB.toFixed(2)} MB of data - this may cause performance issues or context loss!`,
      )
    }
    if (data.instanceCount > 100000) {
      console.warn(
        `[WebGL Synteny] WARNING: ${data.instanceCount} instances is very high - consider increasing zoom level or filtering data!`,
      )
    }

    this.cleanupGeometry()

    const fillSegments = drawCurves
      ? CURVE_FILL_SEGMENTS
      : STRAIGHT_FILL_SEGMENTS
    const edgeSegments = drawCurves
      ? CURVE_EDGE_SEGMENTS
      : STRAIGHT_EDGE_SEGMENTS
    this.rebuildTemplates(fillSegments, edgeSegments)

    this.geometryBpPerPx0 = data.geometryBpPerPx0
    this.geometryBpPerPx1 = data.geometryBpPerPx1
    this.instanceCount = data.instanceCount
    this.nonCigarInstanceCount = data.nonCigarInstanceCount

    if (this.instanceCount > 0) {
      const x1Buf = this.createBuffer(gl, data.x1, 'x1')
      const x2Buf = this.createBuffer(gl, data.x2, 'x2')
      const x3Buf = this.createBuffer(gl, data.x3, 'x3')
      const x4Buf = this.createBuffer(gl, data.x4, 'x4')
      const colorBuf = this.createBuffer(gl, data.colors, 'colors')
      const featureIdBuf = this.createBuffer(gl, data.featureIds, 'featureIds')
      const isCurveBuf = this.createBuffer(gl, data.isCurves, 'isCurves')
      const queryTotalLengthBuf = this.createBuffer(
        gl,
        data.queryTotalLengths,
        'queryTotalLengths',
      )
      const padTopBuf = this.createBuffer(gl, data.padTops, 'padTops')
      const padBottomBuf = this.createBuffer(gl, data.padBottoms, 'padBottoms')

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
        padTopBuf,
        padBottomBuf,
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
        padTopBuf,
        padBottomBuf,
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
        padTopBuf,
        padBottomBuf,
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
        padTopBuf,
        padBottomBuf,
      )

      this.straightFillVao = this.setupInstancedVao(
        gl,
        this.fillProgram!,
        this.straightFillTemplateBuffer!,
        x1Buf,
        x2Buf,
        x3Buf,
        x4Buf,
        colorBuf,
        featureIdBuf,
        isCurveBuf,
        queryTotalLengthBuf,
        padTopBuf,
        padBottomBuf,
      )
      this.straightFillPickingVao = this.setupInstancedVao(
        gl,
        this.fillPickingProgram!,
        this.straightFillTemplateBuffer!,
        x1Buf,
        x2Buf,
        x3Buf,
        x4Buf,
        colorBuf,
        featureIdBuf,
        isCurveBuf,
        queryTotalLengthBuf,
        padTopBuf,
        padBottomBuf,
      )
      this.straightEdgeVao = this.setupInstancedVao(
        gl,
        this.edgeProgram!,
        this.straightEdgeTemplateBuffer!,
        x1Buf,
        x2Buf,
        x3Buf,
        x4Buf,
        colorBuf,
        featureIdBuf,
        isCurveBuf,
        queryTotalLengthBuf,
        padTopBuf,
        padBottomBuf,
      )
      this.straightEdgePickingVao = this.setupInstancedVao(
        gl,
        this.edgePickingProgram!,
        this.straightEdgeTemplateBuffer!,
        x1Buf,
        x2Buf,
        x3Buf,
        x4Buf,
        colorBuf,
        featureIdBuf,
        isCurveBuf,
        queryTotalLengthBuf,
        padTopBuf,
        padBottomBuf,
      )

      console.log('[WebGL Synteny] Geometry upload complete')
      this.memoryTracker.logDetailedReport()
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
    alpha = 1,
    fastScrollMode = false,
  ) {
    if (!this.gl || !this.canvas) {
      return
    }
    const gl = this.gl
    const scale0 = this.geometryBpPerPx0 / curBpPerPx0
    const scale1 = this.geometryBpPerPx1 / curBpPerPx1

    const adjOff0 = offset0 / scale0
    const adjOff1 = offset1 / scale1
    const adjOff0Hi = Math.fround(adjOff0)
    const adjOff0Lo = adjOff0 - adjOff0Hi
    const adjOff1Hi = Math.fround(adjOff1)
    const adjOff1Lo = adjOff1 - adjOff1Hi

    // During scroll: disable blending + force opaque fills + skip edges
    // This eliminates per-fragment read-modify-write and the edge draw call
    if (fastScrollMode) {
      gl.disable(gl.BLEND)
    }

    gl.clear(gl.COLOR_BUFFER_BIT)

    // Use straight VAOs when scrolling AND geometry was built with curves
    // (when curves are off, the normal VAOs already use 1-segment straight lines)
    const useStraightVaos =
      fastScrollMode && this.currentFillSegments > STRAIGHT_FILL_SEGMENTS
    const activeFillVao = useStraightVaos ? this.straightFillVao : this.fillVao
    const activeEdgeVao = useStraightVaos ? this.straightEdgeVao : this.edgeVao
    const activeFillVerts = useStraightVaos
      ? this.straightFillVerticesPerInstance
      : this.fillVerticesPerInstance
    const activeEdgeVerts = useStraightVaos
      ? this.straightEdgeVerticesPerInstance
      : this.edgeVerticesPerInstance

    if (activeFillVao && this.instanceCount > 0) {
      gl.useProgram(this.fillProgram)
      gl.bindVertexArray(activeFillVao)
      const forceOpaque = fastScrollMode ? 1 : 0
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
        alpha,
        forceOpaque,
      )
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        activeFillVerts,
        this.instanceCount,
      )
    }

    // Skip edges during scroll — straight fills are sufficient for visibility
    if (
      !skipEdges &&
      !fastScrollMode &&
      activeEdgeVao &&
      this.nonCigarInstanceCount > 0
    ) {
      gl.useProgram(this.edgeProgram)
      gl.bindVertexArray(activeEdgeVao)
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
        alpha,
      )
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        activeEdgeVerts,
        this.nonCigarInstanceCount,
      )
    }

    gl.bindVertexArray(null)

    if (fastScrollMode) {
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    }

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
        1,
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
        1,
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
    gl.clearColor(1, 1, 1, 1)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
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
    alpha: number,
    forceOpaque = 0,
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
    if (locs.u_alpha) {
      gl.uniform1f(locs.u_alpha, alpha)
    }
    if (locs.u_forceOpaque) {
      gl.uniform1f(locs.u_forceOpaque, forceOpaque)
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

  getInstanceCount() {
    return this.instanceCount
  }

  getNonCigarInstanceCount() {
    return this.nonCigarInstanceCount
  }

  getMemoryReport() {
    return {
      totalMemory: this.memoryTracker.getTotalMemory(),
      bufferMemory: this.memoryTracker.getTotalBufferMemory(),
      textureMemory: this.memoryTracker.getTotalTextureMemory(),
      bufferCount: this.memoryTracker['buffers'].size,
      textureCount: this.memoryTracker['textures'].size,
      vaoCount: this.memoryTracker['vaos'].size,
      programCount: this.memoryTracker['programs'].size,
    }
  }

  logMemoryReport() {
    this.memoryTracker.logDetailedReport()
  }

  dispose() {
    const gl = this.gl
    if (!gl) {
      return
    }

    console.log('[WebGL Synteny] Disposing renderer')
    this.memoryTracker.logDetailedReport()

    this.cleanupGeometry()

    if (this.fillProgram) {
      this.memoryTracker.untrackProgram(this.fillProgram)
      gl.deleteProgram(this.fillProgram)
    }
    if (this.fillPickingProgram) {
      this.memoryTracker.untrackProgram(this.fillPickingProgram)
      gl.deleteProgram(this.fillPickingProgram)
    }
    if (this.edgeProgram) {
      this.memoryTracker.untrackProgram(this.edgeProgram)
      gl.deleteProgram(this.edgeProgram)
    }
    if (this.edgePickingProgram) {
      this.memoryTracker.untrackProgram(this.edgePickingProgram)
      gl.deleteProgram(this.edgePickingProgram)
    }
    if (this.fillTemplateBuffer) {
      this.memoryTracker.untrackBuffer(this.fillTemplateBuffer)
      gl.deleteBuffer(this.fillTemplateBuffer)
    }
    if (this.edgeTemplateBuffer) {
      this.memoryTracker.untrackBuffer(this.edgeTemplateBuffer)
      gl.deleteBuffer(this.edgeTemplateBuffer)
    }
    if (this.straightFillTemplateBuffer) {
      this.memoryTracker.untrackBuffer(this.straightFillTemplateBuffer)
      gl.deleteBuffer(this.straightFillTemplateBuffer)
    }
    if (this.straightEdgeTemplateBuffer) {
      this.memoryTracker.untrackBuffer(this.straightEdgeTemplateBuffer)
      gl.deleteBuffer(this.straightEdgeTemplateBuffer)
    }
    if (this.pickingFramebuffer) {
      gl.deleteFramebuffer(this.pickingFramebuffer)
    }
    if (this.pickingTexture) {
      this.memoryTracker.untrackTexture(this.pickingTexture)
      gl.deleteTexture(this.pickingTexture)
    }

    this.memoryTracker.clear()
    console.log('[WebGL Synteny] Renderer disposed')

    this.gl = null
    this.canvas = null
  }
}
