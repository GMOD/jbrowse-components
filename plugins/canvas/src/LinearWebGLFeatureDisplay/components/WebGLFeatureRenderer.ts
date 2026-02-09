/**
 * WebGL Renderer for feature display
 *
 * Renders gene/transcript features with:
 * - Rectangles for exons, CDS, UTRs
 * - Lines for introns (connecting lines)
 * - Chevrons for strand direction on introns
 * - Arrows for strand direction at feature ends
 *
 * Uses high-precision 12-bit split coordinates (same approach as pileup renderer).
 */

function splitPositionWithFrac(value: number): [number, number] {
  const intValue = Math.floor(value)
  const frac = value - intValue
  const loInt = intValue & 0xfff
  const hi = intValue - loInt
  const lo = loInt + frac
  return [hi, lo]
}

const HP_GLSL_FUNCTIONS = `
const uint HP_LOW_MASK = 0xFFFu;
const float HP_LOW_DIVISOR = 4096.0;

vec2 hpSplitUint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return vec2(float(hi), float(lo));
}

float hpScaleLinear(vec2 splitPos, vec3 domain) {
  float hi = splitPos.x - domain.x;
  float lo = splitPos.y - domain.y;
  return (hi + lo) / domain.z;
}

float hpToClipX(vec2 splitPos, vec3 domain) {
  return hpScaleLinear(splitPos, domain) * 2.0 - 1.0;
}
`

// Rectangle vertex shader - for exons, CDS, UTRs
const RECT_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;   // [startOffset, endOffset] from regionStart
in float a_y;          // top Y in pixels
in float a_height;     // height in pixels
in uvec4 a_color;      // RGBA as uint8s packed

uniform vec3 u_bpRangeX;     // [bpStartHi, bpStartLo, regionLengthBp]
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform float u_canvasWidth;
uniform float u_scrollY;

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  uint absStart = a_position.x + u_regionStart;
  uint absEnd = a_position.y + u_regionStart;
  vec2 splitStart = hpSplitUint(absStart);
  vec2 splitEnd = hpSplitUint(absEnd);
  float sx1 = hpToClipX(splitStart, u_bpRangeX);
  float sx2 = hpToClipX(splitEnd, u_bpRangeX);

  // Ensure minimum width
  float minWidth = 2.0 / u_canvasWidth;
  if (sx2 - sx1 < minWidth) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minWidth * 0.5;
    sx2 = mid + minWidth * 0.5;
  }

  float sx = mix(sx1, sx2, localX);

  // Y position in clip space (top = 1, bottom = -1)
  float yTopPx = a_y - u_scrollY;
  float yBotPx = yTopPx + a_height;
  float syTop = 1.0 - (yTopPx / u_canvasHeight) * 2.0;
  float syBot = 1.0 - (yBotPx / u_canvasHeight) * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Unpack RGBA color
  v_color = vec4(
    float(a_color.r) / 255.0,
    float(a_color.g) / 255.0,
    float(a_color.b) / 255.0,
    float(a_color.a) / 255.0
  );
}
`

const SIMPLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Line vertex shader - for intron connecting lines
const LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;   // [startOffset, endOffset] from regionStart
in float a_y;          // centerY in pixels
in uvec4 a_color;

uniform vec3 u_bpRangeX;
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform float u_scrollY;

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

void main() {
  // Line: 2 vertices per line (start and end points)
  int vid = gl_VertexID % 2;

  uint absStart = a_position.x + u_regionStart;
  uint absEnd = a_position.y + u_regionStart;
  vec2 splitStart = hpSplitUint(absStart);
  vec2 splitEnd = hpSplitUint(absEnd);
  float sx1 = hpToClipX(splitStart, u_bpRangeX);
  float sx2 = hpToClipX(splitEnd, u_bpRangeX);

  float sx = (vid == 0) ? sx1 : sx2;

  float yPx = a_y - u_scrollY;
  float sy = 1.0 - (yPx / u_canvasHeight) * 2.0;

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  v_color = vec4(
    float(a_color.r) / 255.0,
    float(a_color.g) / 255.0,
    float(a_color.b) / 255.0,
    float(a_color.a) / 255.0
  );
}
`

// Max visible chevrons per intron line per frame - only need enough to cover
// the viewport width (~screen_width / 25px spacing ≈ 80)
const MAX_VISIBLE_CHEVRONS_PER_LINE = 128

// Chevron vertex shader - V-shaped strand indicators on introns
// Uses line start/end as instance data and computes chevron positions in shader.
// Only renders chevrons visible in the current viewport by computing which
// chevron indices fall within the viewport bp range.
const CHEVRON_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;   // [startOffset, endOffset] from regionStart (same as line)
in float a_y;          // centerY in pixels
in float a_direction;  // -1 for <, 1 for >
in uvec4 a_color;

uniform vec3 u_bpRangeX;      // [bpStartHi, bpStartLo, viewportLengthBp]
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform float u_canvasWidth;
uniform float u_scrollY;
uniform float u_bpPerPx;

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

void main() {
  // Each instance is a line segment; vertices encode multiple chevrons
  // 4 vertices per chevron (2 lines forming < or >)
  int localChevronIndex = gl_VertexID / 4;
  int vid = gl_VertexID % 4;

  float lineLengthBp = float(a_position.y - a_position.x);
  float lineWidthPx = lineLengthBp / u_bpPerPx;
  float chevronSpacingPx = 25.0;

  // Skip if line too small for any chevrons or no direction
  if (a_direction == 0.0 || lineWidthPx < chevronSpacingPx * 0.5) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_color = vec4(0.0);
    return;
  }

  // Compute total chevrons for the full line (uncapped)
  int totalChevrons = max(1, int(floor(lineWidthPx / chevronSpacingPx)));
  float bpSpacing = lineLengthBp / float(totalChevrons + 1);

  // Find the viewport bp range relative to line start
  float viewportStartBp = u_bpRangeX.x + u_bpRangeX.y - float(u_regionStart) - float(a_position.x);
  float viewportEndBp = viewportStartBp + u_bpRangeX.z;

  // Compute which chevron indices are visible in the viewport
  // chevron i is at bp position: bpSpacing * (i + 1)
  int firstVisible = max(0, int(floor(viewportStartBp / bpSpacing)) - 1);
  int lastVisible = min(totalChevrons - 1, int(ceil(viewportEndBp / bpSpacing)));

  int globalChevronIndex = firstVisible + localChevronIndex;

  // Discard if outside visible range or beyond total
  if (globalChevronIndex > lastVisible || globalChevronIndex >= totalChevrons) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_color = vec4(0.0);
    return;
  }

  // Compute chevron clip-space position along the line
  // Use line start as HP uint base, then add fractional bp offset in clip space
  // to avoid uint truncation causing uneven spacing at high zoom
  float chevronOffsetBp = bpSpacing * float(globalChevronIndex + 1);
  uint lineAbsStart = a_position.x + u_regionStart;
  vec2 splitStart = hpSplitUint(lineAbsStart);
  float cx = hpToClipX(splitStart, u_bpRangeX) + chevronOffsetBp / u_bpRangeX.z * 2.0;

  float yPx = a_y - u_scrollY;
  float cy = 1.0 - (yPx / u_canvasHeight) * 2.0;

  // Chevron size in clip space
  float chevronWidth = 5.0 / u_canvasWidth * 2.0;
  float chevronHeight = 4.0 / u_canvasHeight * 2.0;

  float sx, sy;
  if (a_direction > 0.0) {
    // > shape: point on right
    if (vid == 0) {
      sx = cx - chevronWidth * 0.5;
      sy = cy + chevronHeight * 0.5;
    } else if (vid == 1) {
      sx = cx + chevronWidth * 0.5;
      sy = cy;
    } else if (vid == 2) {
      sx = cx + chevronWidth * 0.5;
      sy = cy;
    } else {
      sx = cx - chevronWidth * 0.5;
      sy = cy - chevronHeight * 0.5;
    }
  } else {
    // < shape: point on left
    if (vid == 0) {
      sx = cx + chevronWidth * 0.5;
      sy = cy + chevronHeight * 0.5;
    } else if (vid == 1) {
      sx = cx - chevronWidth * 0.5;
      sy = cy;
    } else if (vid == 2) {
      sx = cx - chevronWidth * 0.5;
      sy = cy;
    } else {
      sx = cx + chevronWidth * 0.5;
      sy = cy - chevronHeight * 0.5;
    }
  }

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  v_color = vec4(
    float(a_color.r) / 255.0,
    float(a_color.g) / 255.0,
    float(a_color.b) / 255.0,
    float(a_color.a) / 255.0
  );
}
`

// Arrow vertex shader - strand direction arrows at feature ends
// Matches canvas style: horizontal line stem + filled triangle arrowhead
// 9 vertices per instance: 6 for stem rect (2 triangles) + 3 for arrowhead
const ARROW_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_x;
in float a_y;
in float a_direction;  // -1 for left-pointing, 1 for right-pointing
in float a_height;
in uvec4 a_color;

uniform vec3 u_bpRangeX;
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform float u_canvasWidth;
uniform float u_scrollY;

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

void main() {
  int vid = gl_VertexID % 9;

  uint absX = a_x + u_regionStart;
  vec2 splitX = hpSplitUint(absX);
  float cx = hpToClipX(splitX, u_bpRangeX);

  float yPx = a_y - u_scrollY;
  float cy = 1.0 - (yPx / u_canvasHeight) * 2.0;

  // Match canvas: arrowOffset=7px total, arrowSize=5px tall
  float stemLength = 7.0 / u_canvasWidth * 2.0;
  float stemHalf = 0.5 / u_canvasHeight * 2.0;
  float headWidth = 3.5 / u_canvasWidth * 2.0;
  float headHalf = 2.5 / u_canvasHeight * 2.0;

  float dir = a_direction;

  // Stem rect: vertices 0-5 (two triangles)
  // From cx to cx + stemLength/2 (the first half of the 7px line)
  // Head triangle: vertices 6-8
  // From cx + stemLength/2 to cx + stemLength
  float sx, sy;
  if (vid < 6) {
    // Stem rectangle (thin 1px quad from feature edge to arrowhead base)
    float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
    float localY = (vid == 0 || vid == 1 || vid == 4) ? -1.0 : 1.0;
    sx = cx + localX * stemLength * 0.5 * dir;
    sy = cy + localY * stemHalf;
  } else {
    // Arrowhead triangle (from midpoint to tip)
    int hvid = vid - 6;
    if (hvid == 0) {
      sx = cx + stemLength * 0.5 * dir;
      sy = cy + headHalf;
    } else if (hvid == 1) {
      sx = cx + stemLength * 0.5 * dir;
      sy = cy - headHalf;
    } else {
      sx = cx + stemLength * dir;
      sy = cy;
    }
  }

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  v_color = vec4(
    float(a_color.r) / 255.0,
    float(a_color.g) / 255.0,
    float(a_color.b) / 255.0,
    float(a_color.a) / 255.0
  );
}
`

export interface FeatureRenderState {
  scrollY: number
  canvasWidth: number
  canvasHeight: number
}

export interface FeatureRenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
}

interface GPUBuffers {
  regionStart: number
  rectVAO: WebGLVertexArrayObject
  rectCount: number
  lineVAO: WebGLVertexArrayObject | null
  lineCount: number
  arrowVAO: WebGLVertexArrayObject | null
  arrowCount: number
}

// Store line data for dynamic chevron generation
export class WebGLFeatureRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement

  private rectProgram: WebGLProgram
  private lineProgram: WebGLProgram
  private chevronProgram: WebGLProgram
  private arrowProgram: WebGLProgram

  private buffersMap = new Map<number, GPUBuffers>()
  private glBuffersMap = new Map<number, WebGLBuffer[]>()
  private chevronVAOMap = new Map<number, WebGLVertexArrayObject>()
  private chevronGlBuffersMap = new Map<number, WebGLBuffer[]>()
  private chevronLineCountMap = new Map<number, number>()
  private _bufferTarget: WebGLBuffer[] = []

  private rectUniforms: Record<string, WebGLUniformLocation | null> = {}
  private lineUniforms: Record<string, WebGLUniformLocation | null> = {}
  private chevronUniforms: Record<string, WebGLUniformLocation | null> = {}
  private arrowUniforms: Record<string, WebGLUniformLocation | null> = {}

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })

    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.rectProgram = this.createProgram(
      RECT_VERTEX_SHADER,
      SIMPLE_FRAGMENT_SHADER,
    )
    this.lineProgram = this.createProgram(
      LINE_VERTEX_SHADER,
      SIMPLE_FRAGMENT_SHADER,
    )
    this.chevronProgram = this.createProgram(
      CHEVRON_VERTEX_SHADER,
      SIMPLE_FRAGMENT_SHADER,
    )
    this.arrowProgram = this.createProgram(
      ARROW_VERTEX_SHADER,
      SIMPLE_FRAGMENT_SHADER,
    )

    const commonUniforms = [
      'u_bpRangeX',
      'u_regionStart',
      'u_canvasHeight',
      'u_canvasWidth',
      'u_scrollY',
    ]
    this.cacheUniforms(this.rectProgram, this.rectUniforms, commonUniforms)
    this.cacheUniforms(this.lineProgram, this.lineUniforms, [
      'u_bpRangeX',
      'u_regionStart',
      'u_canvasHeight',
      'u_scrollY',
    ])
    this.cacheUniforms(this.chevronProgram, this.chevronUniforms, [
      ...commonUniforms,
      'u_bpPerPx',
    ])
    this.cacheUniforms(this.arrowProgram, this.arrowUniforms, commonUniforms)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(`Shader compile error: ${info}`)
    }
    return shader
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl
    const vs = this.createShader(gl.VERTEX_SHADER, vsSource)
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource)
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

  private cacheUniforms(
    program: WebGLProgram,
    cache: Record<string, WebGLUniformLocation | null>,
    names: string[],
  ) {
    for (const name of names) {
      cache[name] = this.gl.getUniformLocation(program, name)
    }
  }

  uploadForRegion(
    regionNumber: number,
    data: {
      regionStart: number
      rectPositions: Uint32Array
      rectYs: Float32Array
      rectHeights: Float32Array
      rectColors: Uint32Array
      numRects: number
      linePositions: Uint32Array
      lineYs: Float32Array
      lineColors: Uint32Array
      lineDirections: Int8Array
      numLines: number
      arrowXs: Uint32Array
      arrowYs: Float32Array
      arrowDirections: Int8Array
      arrowHeights: Float32Array
      arrowColors: Uint32Array
      numArrows: number
    },
  ) {
    const gl = this.gl

    this.deleteBuffersForRegion(regionNumber)
    this._bufferTarget = []

    // Upload rectangles
    const rectVAO = gl.createVertexArray()
    gl.bindVertexArray(rectVAO)
    this.uploadUintBuffer(this.rectProgram, 'a_position', data.rectPositions, 2)
    this.uploadFloatBuffer(this.rectProgram, 'a_y', data.rectYs, 1)
    this.uploadFloatBuffer(this.rectProgram, 'a_height', data.rectHeights, 1)
    this.uploadColorBuffer(this.rectProgram, 'a_color', data.rectColors)
    gl.bindVertexArray(null)

    // Upload lines
    let lineVAO: WebGLVertexArrayObject | null = null
    if (data.numLines > 0) {
      lineVAO = gl.createVertexArray()!
      gl.bindVertexArray(lineVAO)
      this.uploadUintBuffer(
        this.lineProgram,
        'a_position',
        data.linePositions,
        2,
      )
      this.uploadFloatBuffer(this.lineProgram, 'a_y', data.lineYs, 1)
      this.uploadColorBuffer(this.lineProgram, 'a_color', data.lineColors)
      gl.bindVertexArray(null)
    }

    // Upload chevron VAO from line data (chevrons computed in shader)
    this.deleteChevronBuffersForRegion(regionNumber)
    if (data.numLines > 0) {
      const savedBufferTarget = this._bufferTarget
      this._bufferTarget = []
      const chevronVAO = gl.createVertexArray()!
      gl.bindVertexArray(chevronVAO)
      this.uploadUintBuffer(
        this.chevronProgram,
        'a_position',
        data.linePositions,
        2,
      )
      this.uploadFloatBuffer(this.chevronProgram, 'a_y', data.lineYs, 1)
      this.uploadFloatBuffer(
        this.chevronProgram,
        'a_direction',
        new Float32Array(data.lineDirections),
        1,
      )
      this.uploadColorBuffer(this.chevronProgram, 'a_color', data.lineColors)
      gl.bindVertexArray(null)

      this.chevronVAOMap.set(regionNumber, chevronVAO)
      this.chevronGlBuffersMap.set(regionNumber, this._bufferTarget)
      this.chevronLineCountMap.set(regionNumber, data.numLines)
      this._bufferTarget = savedBufferTarget
    }

    // Upload arrows
    let arrowVAO: WebGLVertexArrayObject | null = null
    if (data.numArrows > 0) {
      arrowVAO = gl.createVertexArray()!
      gl.bindVertexArray(arrowVAO)
      this.uploadUintBuffer(this.arrowProgram, 'a_x', data.arrowXs, 1)
      this.uploadFloatBuffer(this.arrowProgram, 'a_y', data.arrowYs, 1)
      this.uploadFloatBuffer(
        this.arrowProgram,
        'a_direction',
        new Float32Array(data.arrowDirections),
        1,
      )
      this.uploadFloatBuffer(
        this.arrowProgram,
        'a_height',
        data.arrowHeights,
        1,
      )
      this.uploadColorBuffer(this.arrowProgram, 'a_color', data.arrowColors)
      gl.bindVertexArray(null)
    }

    this.glBuffersMap.set(regionNumber, this._bufferTarget)
    this.buffersMap.set(regionNumber, {
      regionStart: data.regionStart,
      rectVAO,
      rectCount: data.numRects,
      lineVAO,
      lineCount: data.numLines,
      arrowVAO,
      arrowCount: data.numArrows,
    })
  }

  private uploadFloatBuffer(
    program: WebGLProgram,
    attrib: string,
    data: Float32Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    this._bufferTarget.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  private uploadUintBuffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint32Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    this._bufferTarget.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_INT, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  private uploadColorBuffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint32Array,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    // Convert packed uint32 colors to uvec4
    const colors = new Uint8Array(data.length * 4)
    for (const [i, datum] of data.entries()) {
      const c = datum
      colors[i * 4] = c & 0xff
      colors[i * 4 + 1] = (c >> 8) & 0xff
      colors[i * 4 + 2] = (c >> 16) & 0xff
      colors[i * 4 + 3] = (c >> 24) & 0xff
    }

    const buffer = gl.createBuffer()
    this._bufferTarget.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, 4, gl.UNSIGNED_BYTE, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  renderBlocks(
    blocks: FeatureRenderBlock[],
    state: FeatureRenderState,
  ) {
    const gl = this.gl
    const canvas = this.canvas
    const { canvasWidth, canvasHeight, scrollY } = state

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (blocks.length === 0) {
      return
    }

    gl.enable(gl.SCISSOR_TEST)

    for (const block of blocks) {
      const buffers = this.buffersMap.get(block.regionNumber)
      if (!buffers || buffers.rectCount === 0) {
        continue
      }

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      gl.scissor(scissorX, 0, scissorW, canvasHeight)
      gl.viewport(scissorX, 0, scissorW, canvasHeight)

      // Compute viewport-clipped genomic bp range for high-precision float split
      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const regionLengthBp = block.bpRangeX[1] - block.bpRangeX[0]
      const bpPerPx = regionLengthBp / fullBlockWidth
      const clippedBpStart =
        block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedBpEnd =
        block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx

      const [bpStartHi, bpStartLo] =
        splitPositionWithFrac(clippedBpStart)
      const clippedLengthBp = clippedBpEnd - clippedBpStart

      const regionStart = buffers.regionStart

      // Draw lines first (introns)
      if (buffers.lineVAO && buffers.lineCount > 0) {
        gl.useProgram(this.lineProgram)
        gl.uniform3f(
          this.lineUniforms.u_bpRangeX!,
          bpStartHi,
          bpStartLo,
          clippedLengthBp,
        )
        gl.uniform1ui(
          this.lineUniforms.u_regionStart!,
          Math.floor(regionStart),
        )
        gl.uniform1f(this.lineUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.lineUniforms.u_scrollY!, scrollY)

        gl.bindVertexArray(buffers.lineVAO)
        gl.drawArraysInstanced(gl.LINES, 0, 2, buffers.lineCount)
      }

      // Draw chevrons (computed in shader from line data)
      const chevronVAO = this.chevronVAOMap.get(block.regionNumber)
      const chevronLineCount = this.chevronLineCountMap.get(block.regionNumber)
      if (chevronVAO && chevronLineCount && chevronLineCount > 0) {
        gl.useProgram(this.chevronProgram)
        gl.uniform3f(
          this.chevronUniforms.u_bpRangeX!,
          bpStartHi,
          bpStartLo,
          clippedLengthBp,
        )
        gl.uniform1ui(
          this.chevronUniforms.u_regionStart!,
          Math.floor(regionStart),
        )
        gl.uniform1f(this.chevronUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.chevronUniforms.u_canvasWidth!, scissorW)
        gl.uniform1f(this.chevronUniforms.u_scrollY!, scrollY)
        gl.uniform1f(this.chevronUniforms.u_bpPerPx!, bpPerPx)

        gl.bindVertexArray(chevronVAO)
        gl.drawArraysInstanced(
          gl.LINES,
          0,
          MAX_VISIBLE_CHEVRONS_PER_LINE * 4,
          chevronLineCount,
        )
      }

      // Draw rectangles (exons, CDS, UTRs)
      gl.useProgram(this.rectProgram)
      gl.uniform3f(
        this.rectUniforms.u_bpRangeX!,
        bpStartHi,
        bpStartLo,
        clippedLengthBp,
      )
      gl.uniform1ui(
        this.rectUniforms.u_regionStart!,
        Math.floor(regionStart),
      )
      gl.uniform1f(this.rectUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.rectUniforms.u_canvasWidth!, scissorW)
      gl.uniform1f(this.rectUniforms.u_scrollY!, scrollY)

      gl.bindVertexArray(buffers.rectVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.rectCount)

      // Draw arrows
      if (buffers.arrowVAO && buffers.arrowCount > 0) {
        gl.useProgram(this.arrowProgram)
        gl.uniform3f(
          this.arrowUniforms.u_bpRangeX!,
          bpStartHi,
          bpStartLo,
          clippedLengthBp,
        )
        gl.uniform1ui(
          this.arrowUniforms.u_regionStart!,
          Math.floor(regionStart),
        )
        gl.uniform1f(this.arrowUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.arrowUniforms.u_canvasWidth!, scissorW)
        gl.uniform1f(this.arrowUniforms.u_scrollY!, scrollY)

        gl.bindVertexArray(buffers.arrowVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 9, buffers.arrowCount)
      }
    }

    gl.bindVertexArray(null)
    gl.disable(gl.SCISSOR_TEST)
    gl.viewport(0, 0, canvasWidth, canvasHeight)
  }

  pruneStaleRegions(activeRegionNumbers: Set<number>) {
    for (const regionNumber of [...this.buffersMap.keys()]) {
      if (!activeRegionNumbers.has(regionNumber)) {
        this.deleteBuffersForRegion(regionNumber)
      }
    }
  }

  clearAllBuffers() {
    for (const regionNumber of [...this.buffersMap.keys()]) {
      this.deleteBuffersForRegion(regionNumber)
    }
  }

  private deleteBuffersForRegion(regionNumber: number) {
    const gl = this.gl
    const glBuffers = this.glBuffersMap.get(regionNumber)
    if (glBuffers) {
      for (const buf of glBuffers) {
        gl.deleteBuffer(buf)
      }
      this.glBuffersMap.delete(regionNumber)
    }
    const buffers = this.buffersMap.get(regionNumber)
    if (buffers) {
      gl.deleteVertexArray(buffers.rectVAO)
      if (buffers.lineVAO) {
        gl.deleteVertexArray(buffers.lineVAO)
      }
      if (buffers.arrowVAO) {
        gl.deleteVertexArray(buffers.arrowVAO)
      }
      this.buffersMap.delete(regionNumber)
    }
    this.deleteChevronBuffersForRegion(regionNumber)
  }

  private deleteChevronBuffersForRegion(regionNumber: number) {
    const gl = this.gl
    const chevronGlBuffers = this.chevronGlBuffersMap.get(regionNumber)
    if (chevronGlBuffers) {
      for (const buf of chevronGlBuffers) {
        gl.deleteBuffer(buf)
      }
      this.chevronGlBuffersMap.delete(regionNumber)
    }
    const chevronVAO = this.chevronVAOMap.get(regionNumber)
    if (chevronVAO) {
      gl.deleteVertexArray(chevronVAO)
      this.chevronVAOMap.delete(regionNumber)
    }
    this.chevronLineCountMap.delete(regionNumber)
  }

  destroy() {
    this.clearAllBuffers()
    const gl = this.gl
    gl.deleteProgram(this.rectProgram)
    gl.deleteProgram(this.lineProgram)
    gl.deleteProgram(this.chevronProgram)
    gl.deleteProgram(this.arrowProgram)
  }
}
