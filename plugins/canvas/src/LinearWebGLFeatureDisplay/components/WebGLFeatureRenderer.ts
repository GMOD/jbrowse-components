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

uniform vec3 u_domainX;     // [domainStartHi, domainStartLo, domainExtent]
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
  float sx1 = hpToClipX(splitStart, u_domainX);
  float sx2 = hpToClipX(splitEnd, u_domainX);

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

const RECT_FRAGMENT_SHADER = `#version 300 es
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

uniform vec3 u_domainX;
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
  float sx1 = hpToClipX(splitStart, u_domainX);
  float sx2 = hpToClipX(splitEnd, u_domainX);

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

const LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Chevron vertex shader - V-shaped strand indicators on introns
const CHEVRON_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_x;           // X offset from regionStart
in float a_y;          // centerY in pixels
in float a_direction;  // -1 for <, 1 for >
in uvec4 a_color;

uniform vec3 u_domainX;
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform float u_canvasWidth;
uniform float u_scrollY;

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

void main() {
  // Chevron: 4 vertices per chevron (2 lines forming < or >)
  int vid = gl_VertexID % 4;

  uint absX = a_x + u_regionStart;
  vec2 splitX = hpSplitUint(absX);
  float cx = hpToClipX(splitX, u_domainX);

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

const CHEVRON_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Arrow vertex shader - strand direction arrows at feature ends
const ARROW_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_x;
in float a_y;
in float a_direction;  // -1 for left-pointing, 1 for right-pointing
in float a_height;
in uvec4 a_color;

uniform vec3 u_domainX;
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform float u_canvasWidth;
uniform float u_scrollY;

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

void main() {
  // Arrow: 3 vertices for triangle
  int vid = gl_VertexID % 3;

  uint absX = a_x + u_regionStart;
  vec2 splitX = hpSplitUint(absX);
  float cx = hpToClipX(splitX, u_domainX);

  float yPx = a_y - u_scrollY;
  float cy = 1.0 - (yPx / u_canvasHeight) * 2.0;

  // Arrow size
  float arrowWidth = 7.0 / u_canvasWidth * 2.0;
  float arrowHeight = min(a_height * 0.8, 8.0) / u_canvasHeight * 2.0;

  float sx, sy;
  if (a_direction > 0.0) {
    // Right-pointing arrow >
    if (vid == 0) {
      sx = cx;
      sy = cy + arrowHeight * 0.5;
    } else if (vid == 1) {
      sx = cx;
      sy = cy - arrowHeight * 0.5;
    } else {
      sx = cx + arrowWidth;
      sy = cy;
    }
  } else {
    // Left-pointing arrow <
    if (vid == 0) {
      sx = cx;
      sy = cy + arrowHeight * 0.5;
    } else if (vid == 1) {
      sx = cx;
      sy = cy - arrowHeight * 0.5;
    } else {
      sx = cx - arrowWidth;
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

const ARROW_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

export interface FeatureRenderState {
  domainX: [number, number]
  scrollY: number
  canvasWidth: number
  canvasHeight: number
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
interface LineDataForChevrons {
  positions: Uint32Array
  ys: Float32Array
  colors: Uint32Array
  directions: Int8Array
  count: number
}

export class WebGLFeatureRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement

  private rectProgram: WebGLProgram
  private lineProgram: WebGLProgram
  private chevronProgram: WebGLProgram
  private arrowProgram: WebGLProgram

  private buffers: GPUBuffers | null = null
  private lineData: LineDataForChevrons | null = null
  private chevronVAO: WebGLVertexArrayObject | null = null
  private chevronCount = 0
  private glBuffers: WebGLBuffer[] = []
  private chevronGlBuffers: WebGLBuffer[] = []
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
      RECT_FRAGMENT_SHADER,
    )
    this.lineProgram = this.createProgram(
      LINE_VERTEX_SHADER,
      LINE_FRAGMENT_SHADER,
    )
    this.chevronProgram = this.createProgram(
      CHEVRON_VERTEX_SHADER,
      CHEVRON_FRAGMENT_SHADER,
    )
    this.arrowProgram = this.createProgram(
      ARROW_VERTEX_SHADER,
      ARROW_FRAGMENT_SHADER,
    )

    const commonUniforms = [
      'u_domainX',
      'u_regionStart',
      'u_canvasHeight',
      'u_canvasWidth',
      'u_scrollY',
    ]
    this.cacheUniforms(this.rectProgram, this.rectUniforms, commonUniforms)
    this.cacheUniforms(this.lineProgram, this.lineUniforms, [
      'u_domainX',
      'u_regionStart',
      'u_canvasHeight',
      'u_scrollY',
    ])
    this.cacheUniforms(
      this.chevronProgram,
      this.chevronUniforms,
      commonUniforms,
    )
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
    const program = gl.createProgram()
    gl.attachShader(program, this.createShader(gl.VERTEX_SHADER, vsSource))
    gl.attachShader(program, this.createShader(gl.FRAGMENT_SHADER, fsSource))
    gl.linkProgram(program)
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

  uploadFromTypedArrays(data: {
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
  }) {
    const gl = this.gl

    this.deleteMainBuffers()
    this.deleteChevronBuffers()
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

    // Store line data for dynamic chevron generation at render time
    this.lineData =
      data.numLines > 0
        ? {
            positions: data.linePositions,
            ys: data.lineYs,
            colors: data.lineColors,
            directions: data.lineDirections,
            count: data.numLines,
          }
        : null

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

    this.buffers = {
      regionStart: data.regionStart,
      rectVAO,
      rectCount: data.numRects,
      lineVAO,
      lineCount: data.numLines,
      arrowVAO,
      arrowCount: data.numArrows,
    }
    this.glBuffers = this._bufferTarget
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
    if (buffer) {
      this._bufferTarget.push(buffer)
    }
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
    if (buffer) {
      this._bufferTarget.push(buffer)
    }
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
    if (buffer) {
      this._bufferTarget.push(buffer)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, 4, gl.UNSIGNED_BYTE, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  render(state: FeatureRenderState) {
    const gl = this.gl
    const canvas = this.canvas
    const { canvasWidth, canvasHeight, domainX, scrollY } = state

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.buffers || this.buffers.rectCount === 0) {
      return
    }

    const regionStart = this.buffers.regionStart
    const [domainStartHi, domainStartLo] = splitPositionWithFrac(domainX[0])
    const domainExtent = domainX[1] - domainX[0]

    // Draw lines first (introns)
    if (this.buffers.lineVAO && this.buffers.lineCount > 0) {
      gl.useProgram(this.lineProgram)
      gl.uniform3f(
        this.lineUniforms.u_domainX!,
        domainStartHi,
        domainStartLo,
        domainExtent,
      )
      gl.uniform1ui(this.lineUniforms.u_regionStart!, Math.floor(regionStart))
      gl.uniform1f(this.lineUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.lineUniforms.u_scrollY!, scrollY)

      gl.bindVertexArray(this.buffers.lineVAO)
      gl.drawArraysInstanced(gl.LINES, 0, 2, this.buffers.lineCount)
    }

    // Generate and draw chevrons dynamically (constant pixel spacing)
    if (this.lineData && this.lineData.count > 0) {
      this.renderDynamicChevrons(
        regionStart,
        domainX,
        domainStartHi,
        domainStartLo,
        domainExtent,
        canvasWidth,
        canvasHeight,
        scrollY,
      )
    }

    // Draw rectangles (exons, CDS, UTRs)
    gl.useProgram(this.rectProgram)
    gl.uniform3f(
      this.rectUniforms.u_domainX!,
      domainStartHi,
      domainStartLo,
      domainExtent,
    )
    gl.uniform1ui(this.rectUniforms.u_regionStart!, Math.floor(regionStart))
    gl.uniform1f(this.rectUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(this.rectUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform1f(this.rectUniforms.u_scrollY!, scrollY)

    gl.bindVertexArray(this.buffers.rectVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.rectCount)

    // Draw arrows
    if (this.buffers.arrowVAO && this.buffers.arrowCount > 0) {
      gl.useProgram(this.arrowProgram)
      gl.uniform3f(
        this.arrowUniforms.u_domainX!,
        domainStartHi,
        domainStartLo,
        domainExtent,
      )
      gl.uniform1ui(this.arrowUniforms.u_regionStart!, Math.floor(regionStart))
      gl.uniform1f(this.arrowUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.arrowUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform1f(this.arrowUniforms.u_scrollY!, scrollY)

      gl.bindVertexArray(this.buffers.arrowVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, this.buffers.arrowCount)
    }

    gl.bindVertexArray(null)
  }

  private renderDynamicChevrons(
    regionStart: number,
    domainX: [number, number],
    domainStartHi: number,
    domainStartLo: number,
    domainExtent: number,
    canvasWidth: number,
    canvasHeight: number,
    scrollY: number,
  ) {
    const gl = this.gl
    const lineData = this.lineData
    if (!lineData) {
      return
    }

    const CHEVRON_PIXEL_SPACING = 25 // pixels between chevrons
    const bpPerPx = domainExtent / canvasWidth

    // Generate chevrons for each line with a non-zero direction
    const chevronXs: number[] = []
    const chevronYs: number[] = []
    const chevronDirections: number[] = []
    const chevronColors: number[] = []

    for (let i = 0; i < lineData.count; i++) {
      const direction = lineData.directions[i]
      if (direction === undefined || direction === 0) {
        continue
      }

      const startOffset = lineData.positions[i * 2]!
      const endOffset = lineData.positions[i * 2 + 1]!
      const y = lineData.ys[i]!
      const color = lineData.colors[i]!

      // Convert to absolute positions
      const startBp = regionStart + startOffset
      const endBp = regionStart + endOffset

      // Calculate line width in pixels at current zoom
      const lineWidthPx = (endBp - startBp) / bpPerPx

      // Skip if line is too small for chevrons
      if (lineWidthPx < CHEVRON_PIXEL_SPACING * 0.5) {
        continue
      }

      // Calculate number of chevrons that fit
      const numChevrons = Math.max(
        1,
        Math.floor(lineWidthPx / CHEVRON_PIXEL_SPACING),
      )
      const bpSpacing = (endBp - startBp) / (numChevrons + 1)

      for (let j = 1; j <= numChevrons; j++) {
        const chevronBp = startBp + bpSpacing * j
        // Store as offset from regionStart
        chevronXs.push(Math.floor(chevronBp - regionStart))
        chevronYs.push(y)
        chevronDirections.push(direction)
        chevronColors.push(color)
      }
    }

    if (chevronXs.length === 0) {
      return
    }

    this.deleteChevronBuffers()
    this._bufferTarget = []

    // Create and upload chevron buffers
    this.chevronVAO = gl.createVertexArray()!
    gl.bindVertexArray(this.chevronVAO)
    this.uploadUintBuffer(
      this.chevronProgram,
      'a_x',
      new Uint32Array(chevronXs),
      1,
    )
    this.uploadFloatBuffer(
      this.chevronProgram,
      'a_y',
      new Float32Array(chevronYs),
      1,
    )
    this.uploadFloatBuffer(
      this.chevronProgram,
      'a_direction',
      new Float32Array(chevronDirections),
      1,
    )
    this.uploadColorBuffer(
      this.chevronProgram,
      'a_color',
      new Uint32Array(chevronColors),
    )
    gl.bindVertexArray(null)

    this.chevronCount = chevronXs.length
    this.chevronGlBuffers = this._bufferTarget

    // Draw chevrons
    gl.useProgram(this.chevronProgram)
    gl.uniform3f(
      this.chevronUniforms.u_domainX!,
      domainStartHi,
      domainStartLo,
      domainExtent,
    )
    gl.uniform1ui(this.chevronUniforms.u_regionStart!, Math.floor(regionStart))
    gl.uniform1f(this.chevronUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(this.chevronUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform1f(this.chevronUniforms.u_scrollY!, scrollY)

    gl.bindVertexArray(this.chevronVAO)
    gl.drawArraysInstanced(gl.LINES, 0, 4, this.chevronCount)
  }

  private deleteMainBuffers() {
    const gl = this.gl
    for (const buf of this.glBuffers) {
      gl.deleteBuffer(buf)
    }
    this.glBuffers = []
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.rectVAO)
      if (this.buffers.lineVAO) {
        gl.deleteVertexArray(this.buffers.lineVAO)
      }
      if (this.buffers.arrowVAO) {
        gl.deleteVertexArray(this.buffers.arrowVAO)
      }
      this.buffers = null
    }
  }

  private deleteChevronBuffers() {
    const gl = this.gl
    for (const buf of this.chevronGlBuffers) {
      gl.deleteBuffer(buf)
    }
    this.chevronGlBuffers = []
    if (this.chevronVAO) {
      gl.deleteVertexArray(this.chevronVAO)
      this.chevronVAO = null
    }
  }

  destroy() {
    this.deleteMainBuffers()
    this.deleteChevronBuffers()
    const gl = this.gl
    gl.deleteProgram(this.rectProgram)
    gl.deleteProgram(this.lineProgram)
    gl.deleteProgram(this.chevronProgram)
    gl.deleteProgram(this.arrowProgram)
  }
}
