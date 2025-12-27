/**
 * Experimental WebGL renderer for synteny display
 *
 * This module provides a WebGL-based alternative to the canvas 2D rendering
 * for synteny visualization. Benefits include:
 * - GPU-accelerated rendering for large numbers of features
 * - Integer-based picking for precise feature selection (no color encoding limits)
 * - Potential for smoother animations and transitions
 */

import type { FeatPos } from './model'

// Vertex shader for rendering trapezoids
// Geometry is stored in "offset pixels" (pre-computed from bp coordinates)
// Transforms (scroll offsets) are applied via uniforms on the GPU
const vertexShaderSource = `#version 300 es
precision highp float;

// Per-vertex attributes
in float a_position_x;    // X position in offsetPx
in float a_position_y;    // Y as 0.0 (top) or 1.0 (bottom)
in float a_row;           // Which row: 0.0 = top view, 1.0 = bottom view
in vec4 a_color;
in float a_featureId;

// Uniforms for transforms - updated each frame without rebuilding geometry
uniform vec2 u_resolution;      // Canvas size in CSS pixels
uniform float u_height;         // Height of synteny area
uniform float u_offset0;        // Scroll offset for top view (row 0)
uniform float u_offset1;        // Scroll offset for bottom view (row 1)

// Outputs to fragment shader
out vec4 v_color;
flat out float v_featureId;

void main() {
  // Select offset based on which row this vertex belongs to
  float offset = mix(u_offset0, u_offset1, a_row);

  // Apply scroll transform
  float x = a_position_x - offset;
  float y = a_position_y * u_height;

  // Convert from pixel coordinates to clip space (-1 to 1)
  vec2 clipSpace = (vec2(x, y) / u_resolution) * 2.0 - 1.0;
  // Flip Y axis (canvas Y grows down, WebGL Y grows up)
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);

  v_color = a_color;
  v_featureId = a_featureId;
}
`

// Fragment shader for main rendering
const fragmentShaderSource = `#version 300 es
precision highp float;

in vec4 v_color;

out vec4 outColor;

void main() {
  outColor = v_color;
}
`

// Fragment shader for picking - outputs feature ID as color
const pickingFragmentShaderSource = `#version 300 es
precision highp float;

flat in float v_featureId;

out vec4 outColor;

void main() {
  // Encode feature ID into RGBA
  // This gives us 2^32 unique IDs (vs 2^24 with RGB only)
  float id = v_featureId;
  float r = mod(id, 256.0) / 255.0;
  float g = mod(floor(id / 256.0), 256.0) / 255.0;
  float b = mod(floor(id / 65536.0), 256.0) / 255.0;
  float a = mod(floor(id / 16777216.0), 256.0) / 255.0;
  outColor = vec4(r, g, b, 1.0);
}
`

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
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
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram()
  if (!program) {
    throw new Error('Failed to create program')
  }
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${info}`)
  }
  return program
}

interface WebGLResources {
  gl: WebGL2RenderingContext
  mainProgram: WebGLProgram
  pickingProgram: WebGLProgram
  positionXBuffer: WebGLBuffer
  positionYBuffer: WebGLBuffer
  rowBuffer: WebGLBuffer
  colorBuffer: WebGLBuffer
  featureIdBuffer: WebGLBuffer
  pickingFramebuffer: WebGLFramebuffer
  pickingTexture: WebGLTexture
  vao: WebGLVertexArrayObject
  pickingVao: WebGLVertexArrayObject
}

export class SyntenyWebGLRenderer {
  private resources: WebGLResources | null = null
  private canvas: HTMLCanvasElement | null = null
  private width = 0
  private height = 0
  private vertexCount = 0
  private devicePixelRatio = 1

  init(canvas: HTMLCanvasElement): boolean {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    })

    if (!gl) {
      console.warn('WebGL2 not supported')
      return false
    }

    this.canvas = canvas
    // Use device pixel ratio for sharper rendering on high-DPI displays
    this.devicePixelRatio = window.devicePixelRatio || 1
    this.width = canvas.width
    this.height = canvas.height

    try {
      // Create shaders
      const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
      const mainFragShader = createShader(
        gl,
        gl.FRAGMENT_SHADER,
        fragmentShaderSource,
      )
      const pickingFragShader = createShader(
        gl,
        gl.FRAGMENT_SHADER,
        pickingFragmentShaderSource,
      )

      // Create programs
      const mainProgram = createProgram(gl, vertexShader, mainFragShader)
      const pickingProgram = createProgram(gl, vertexShader, pickingFragShader)

      // Create buffers for the new attribute layout
      const positionXBuffer = gl.createBuffer()
      const positionYBuffer = gl.createBuffer()
      const rowBuffer = gl.createBuffer()
      const colorBuffer = gl.createBuffer()
      const featureIdBuffer = gl.createBuffer()

      if (!positionXBuffer || !positionYBuffer || !rowBuffer || !colorBuffer || !featureIdBuffer) {
        throw new Error('Failed to create buffers')
      }

      // Create VAO for main rendering
      const vao = gl.createVertexArray()
      if (!vao) {
        throw new Error('Failed to create VAO')
      }

      gl.bindVertexArray(vao)
      this.setupAttributes(gl, mainProgram, positionXBuffer, positionYBuffer, rowBuffer, colorBuffer, featureIdBuffer)
      gl.bindVertexArray(null)

      // Create VAO for picking
      const pickingVao = gl.createVertexArray()
      if (!pickingVao) {
        throw new Error('Failed to create picking VAO')
      }

      gl.bindVertexArray(pickingVao)
      this.setupAttributes(gl, pickingProgram, positionXBuffer, positionYBuffer, rowBuffer, colorBuffer, featureIdBuffer)
      gl.bindVertexArray(null)

      // Create picking framebuffer and texture
      const pickingFramebuffer = gl.createFramebuffer()
      const pickingTexture = gl.createTexture()

      if (!pickingFramebuffer || !pickingTexture) {
        throw new Error('Failed to create picking framebuffer')
      }

      gl.bindTexture(gl.TEXTURE_2D, pickingTexture)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        this.width,
        this.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      )
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

      gl.bindFramebuffer(gl.FRAMEBUFFER, pickingFramebuffer)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        pickingTexture,
        0,
      )
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)

      this.resources = {
        gl,
        mainProgram,
        pickingProgram,
        positionXBuffer,
        positionYBuffer,
        rowBuffer,
        colorBuffer,
        featureIdBuffer,
        pickingFramebuffer,
        pickingTexture,
        vao,
        pickingVao,
      }

      return true
    } catch (e) {
      console.error('WebGL initialization failed:', e)
      return false
    }
  }

  private setupAttributes(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    positionXBuffer: WebGLBuffer,
    positionYBuffer: WebGLBuffer,
    rowBuffer: WebGLBuffer,
    colorBuffer: WebGLBuffer,
    featureIdBuffer: WebGLBuffer,
  ) {
    const positionXLoc = gl.getAttribLocation(program, 'a_position_x')
    const positionYLoc = gl.getAttribLocation(program, 'a_position_y')
    const rowLoc = gl.getAttribLocation(program, 'a_row')
    const colorLoc = gl.getAttribLocation(program, 'a_color')
    const featureIdLoc = gl.getAttribLocation(program, 'a_featureId')

    gl.bindBuffer(gl.ARRAY_BUFFER, positionXBuffer)
    gl.enableVertexAttribArray(positionXLoc)
    gl.vertexAttribPointer(positionXLoc, 1, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, positionYBuffer)
    gl.enableVertexAttribArray(positionYLoc)
    gl.vertexAttribPointer(positionYLoc, 1, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, rowBuffer)
    gl.enableVertexAttribArray(rowLoc)
    gl.vertexAttribPointer(rowLoc, 1, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
    gl.enableVertexAttribArray(colorLoc)
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, featureIdBuffer)
    gl.enableVertexAttribArray(featureIdLoc)
    gl.vertexAttribPointer(featureIdLoc, 1, gl.FLOAT, false, 0, 0)
  }

  resize(width: number, height: number) {
    if (!this.resources || !this.canvas) {
      return
    }

    // Calculate actual DPR from canvas size vs CSS size
    this.devicePixelRatio = this.canvas.width / width
    this.width = width
    this.height = height

    const { gl, pickingTexture } = this.resources

    // Get actual canvas dimensions (may be scaled by devicePixelRatio)
    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height

    // Resize picking texture to match canvas resolution
    gl.bindTexture(gl.TEXTURE_2D, pickingTexture)
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
  }

  /**
   * Build geometry from feature positions - called once when features change
   * Stores offsetPx values directly; scroll transforms are applied via uniforms
   * @param drawCurves - if true, tessellate bezier curves
   */
  buildGeometry(
    featPositions: FeatPos[],
    level: number,
    alpha: number,
    colorFn: (f: FeatPos, index: number) => [number, number, number],
    drawCurves: boolean = false,
  ) {
    if (!this.resources) {
      return
    }

    const { gl, positionXBuffer, positionYBuffer, rowBuffer, colorBuffer, featureIdBuffer } = this.resources

    const segments = drawCurves ? 16 : 1 // Number of segments for bezier tessellation

    const positionsX: number[] = []
    const positionsY: number[] = []
    const rows: number[] = []
    const colors: number[] = []
    const featureIds: number[] = []

    for (let i = 0; i < featPositions.length; i++) {
      const feat = featPositions[i]!
      const { p11, p12, p21, p22 } = feat

      // Store raw offsetPx values - transforms applied in shader
      const x11 = p11.offsetPx
      const x12 = p12.offsetPx
      const x21 = p21.offsetPx
      const x22 = p22.offsetPx

      const [r, g, b] = colorFn(feat, i)
      const featureId = i + 1 // +1 so 0 means "no feature"

      if (drawCurves) {
        // Tessellate bezier curves
        // For bezier, we interpolate between top row (y=0) and bottom row (y=1)
        // The shader will multiply by height
        for (let s = 0; s < segments; s++) {
          const t0 = s / segments
          const t1 = (s + 1) / segments

          // Bezier interpolation for t0
          const t0_2 = t0 * t0
          const t0_3 = t0_2 * t0
          const mt0 = 1 - t0
          const mt0_2 = mt0 * mt0
          const mt0_3 = mt0_2 * mt0

          // Bezier interpolation for t1
          const t1_2 = t1 * t1
          const t1_3 = t1_2 * t1
          const mt1 = 1 - t1
          const mt1_2 = mt1 * mt1
          const mt1_3 = mt1_2 * mt1

          // Left edge at t0 and t1
          const lx0 = mt0_3 * x11 + 3 * mt0_2 * t0 * x11 + 3 * mt0 * t0_2 * x21 + t0_3 * x21
          const ly0 = mt0_3 * 0 + 3 * mt0_2 * t0 * 0.5 + 3 * mt0 * t0_2 * 0.5 + t0_3 * 1
          const lr0 = ly0 < 0.5 ? 0 : 1 // Which row for offset lookup

          const lx1 = mt1_3 * x11 + 3 * mt1_2 * t1 * x11 + 3 * mt1 * t1_2 * x21 + t1_3 * x21
          const ly1 = mt1_3 * 0 + 3 * mt1_2 * t1 * 0.5 + 3 * mt1 * t1_2 * 0.5 + t1_3 * 1

          // Right edge at t0 and t1
          const rx0 = mt0_3 * x12 + 3 * mt0_2 * t0 * x12 + 3 * mt0 * t0_2 * x22 + t0_3 * x22
          const ry0 = ly0
          const rx1 = mt1_3 * x12 + 3 * mt1_2 * t1 * x12 + 3 * mt1 * t1_2 * x22 + t1_3 * x22
          const ry1 = ly1

          // For bezier segments, we need to interpolate the row based on y position
          // Use the t value to blend between row 0 and row 1
          const row0 = t0
          const row1 = t1

          // Two triangles per segment
          // Triangle 1: left-t0, right-t0, left-t1
          positionsX.push(lx0, rx0, lx1)
          positionsY.push(ly0, ry0, ly1)
          rows.push(row0, row0, row1)
          // Triangle 2: left-t1, right-t0, right-t1
          positionsX.push(lx1, rx0, rx1)
          positionsY.push(ly1, ry0, ry1)
          rows.push(row1, row0, row1)

          // 6 vertices per quad
          for (let v = 0; v < 6; v++) {
            colors.push(r, g, b, alpha)
            featureIds.push(featureId)
          }
        }
      } else {
        // Simple straight trapezoid - 2 triangles
        // Triangle 1: top-left, top-right, bottom-right
        positionsX.push(x11, x12, x22)
        positionsY.push(0, 0, 1)
        rows.push(0, 0, 1) // top vertices use row 0 offset, bottom use row 1
        // Triangle 2: top-left, bottom-right, bottom-left
        positionsX.push(x11, x22, x21)
        positionsY.push(0, 1, 1)
        rows.push(0, 1, 1)

        // 6 vertices total
        for (let v = 0; v < 6; v++) {
          colors.push(r, g, b, alpha)
          featureIds.push(featureId)
        }
      }
    }

    this.vertexCount = positionsX.length

    // Upload to GPU - this only needs to happen when features change
    gl.bindBuffer(gl.ARRAY_BUFFER, positionXBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionsX), gl.STATIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, positionYBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionsY), gl.STATIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, rowBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rows), gl.STATIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, featureIdBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(featureIds), gl.STATIC_DRAW)
  }

  /**
   * Render the synteny display
   * @param offset0 - scroll offset for top view (level)
   * @param offset1 - scroll offset for bottom view (level + 1)
   * @param height - height of the synteny area in CSS pixels
   */
  render(offset0: number, offset1: number, height: number) {
    if (!this.resources || !this.canvas || this.vertexCount === 0) {
      return
    }

    const { gl, mainProgram, vao } = this.resources

    // Use actual canvas dimensions for viewport
    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    gl.useProgram(mainProgram)
    gl.bindVertexArray(vao)

    // Set uniforms - this is the only thing that changes per frame!
    const resolutionLoc = gl.getUniformLocation(mainProgram, 'u_resolution')
    const heightLoc = gl.getUniformLocation(mainProgram, 'u_height')
    const offset0Loc = gl.getUniformLocation(mainProgram, 'u_offset0')
    const offset1Loc = gl.getUniformLocation(mainProgram, 'u_offset1')

    gl.uniform2f(resolutionLoc, this.width, this.height)
    gl.uniform1f(heightLoc, height)
    gl.uniform1f(offset0Loc, offset0)
    gl.uniform1f(offset1Loc, offset1)

    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount)

    gl.bindVertexArray(null)
  }

  /**
   * Render to the picking buffer (offscreen)
   * @param offset0 - scroll offset for top view
   * @param offset1 - scroll offset for bottom view
   * @param height - height of the synteny area
   */
  renderPicking(offset0: number, offset1: number, height: number) {
    if (!this.resources || !this.canvas || this.vertexCount === 0) {
      return
    }

    const { gl, pickingProgram, pickingFramebuffer, pickingVao } = this.resources

    // Use actual canvas dimensions
    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height

    gl.bindFramebuffer(gl.FRAMEBUFFER, pickingFramebuffer)
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.disable(gl.BLEND) // No blending for picking

    gl.useProgram(pickingProgram)
    gl.bindVertexArray(pickingVao)

    // Set the same uniforms as render
    const resolutionLoc = gl.getUniformLocation(pickingProgram, 'u_resolution')
    const heightLoc = gl.getUniformLocation(pickingProgram, 'u_height')
    const offset0Loc = gl.getUniformLocation(pickingProgram, 'u_offset0')
    const offset1Loc = gl.getUniformLocation(pickingProgram, 'u_offset1')

    gl.uniform2f(resolutionLoc, this.width, this.height)
    gl.uniform1f(heightLoc, height)
    gl.uniform1f(offset0Loc, offset0)
    gl.uniform1f(offset1Loc, offset1)

    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount)

    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /**
   * Get the feature ID at a given pixel position (in CSS pixels)
   * Returns -1 if no feature at that position
   */
  pick(x: number, y: number): number {
    if (!this.resources || !this.canvas) {
      return -1
    }

    const { gl, pickingFramebuffer } = this.resources

    // Scale CSS pixel coordinates to canvas pixel coordinates
    const dpr = this.devicePixelRatio
    const canvasX = Math.floor(x * dpr)
    const canvasY = Math.floor(y * dpr)
    const canvasHeight = this.canvas.height

    gl.bindFramebuffer(gl.FRAMEBUFFER, pickingFramebuffer)

    const pixel = new Uint8Array(4)
    // Note: WebGL Y is flipped
    gl.readPixels(canvasX, canvasHeight - canvasY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    const [r, g, b] = pixel
    if (r === 0 && g === 0 && b === 0) {
      return -1
    }

    // Decode feature ID from RGBA
    const id = r! + g! * 256 + b! * 65536
    return id - 1 // -1 because we added 1 when encoding
  }

  /**
   * Clean up WebGL resources
   */
  dispose() {
    if (!this.resources) {
      return
    }

    const {
      gl,
      mainProgram,
      pickingProgram,
      positionXBuffer,
      positionYBuffer,
      rowBuffer,
      colorBuffer,
      featureIdBuffer,
      pickingFramebuffer,
      pickingTexture,
      vao,
      pickingVao,
    } = this.resources

    gl.deleteProgram(mainProgram)
    gl.deleteProgram(pickingProgram)
    gl.deleteBuffer(positionXBuffer)
    gl.deleteBuffer(positionYBuffer)
    gl.deleteBuffer(rowBuffer)
    gl.deleteBuffer(colorBuffer)
    gl.deleteBuffer(featureIdBuffer)
    gl.deleteFramebuffer(pickingFramebuffer)
    gl.deleteTexture(pickingTexture)
    gl.deleteVertexArray(vao)
    gl.deleteVertexArray(pickingVao)

    this.resources = null
    this.canvas = null
  }

  /**
   * Check if geometry has been built
   */
  hasGeometry(): boolean {
    return this.vertexCount > 0
  }
}

/**
 * Helper to create a color function based on colorBy mode
 */
export function createColorFunction(
  colorBy: string,
): (f: FeatPos, index: number) => [number, number, number] {
  if (colorBy === 'strand') {
    return (f: FeatPos) => {
      const strand = f.f.get('strand')
      // Red for positive, blue for negative
      return strand === -1 ? [0.2, 0.2, 0.8] : [0.8, 0.2, 0.2]
    }
  }

  if (colorBy === 'query') {
    // Simple hash-based coloring by query name
    const colorCache = new Map<string, [number, number, number]>()
    const palette: [number, number, number][] = [
      [0.12, 0.47, 0.71],
      [1.0, 0.5, 0.05],
      [0.17, 0.63, 0.17],
      [0.84, 0.15, 0.16],
      [0.58, 0.4, 0.74],
      [0.55, 0.34, 0.29],
      [0.89, 0.47, 0.76],
      [0.5, 0.5, 0.5],
      [0.74, 0.74, 0.13],
      [0.09, 0.75, 0.81],
    ]

    return (f: FeatPos) => {
      const name = f.f.get('refName') || ''
      if (!colorCache.has(name)) {
        let hash = 0
        for (let i = 0; i < name.length; i++) {
          hash = (hash << 5) - hash + name.charCodeAt(i)
          hash = hash & hash
        }
        colorCache.set(name, palette[Math.abs(hash) % palette.length]!)
      }
      return colorCache.get(name)!
    }
  }

  // Default: red with alpha
  return () => [0.9, 0.1, 0.1]
}

/**
 * Tessellate a bezier curve box into triangles
 * The bezier box has 4 corners (x1,y1), (x2,y1), (x3,y2), (x4,y2)
 * with bezier curves connecting them
 */
function tessellateBezierBox(
  x1: number, // top-left
  x2: number, // top-right
  y1: number, // top y
  x3: number, // bottom-right
  x4: number, // bottom-left
  y2: number, // bottom y
  segments: number = 8,
): number[] {
  const positions: number[] = []
  const mid = (y1 + y2) / 2

  // Sample points along left and right bezier edges
  const leftPoints: [number, number][] = []
  const rightPoints: [number, number][] = []

  for (let i = 0; i <= segments; i++) {
    const t = i / segments

    // Cubic bezier: P = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
    // For left edge: P0=(x1,y1), P1=(x1,mid), P2=(x4,mid), P3=(x4,y2)
    const t2 = t * t
    const t3 = t2 * t
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt

    const leftX = mt3 * x1 + 3 * mt2 * t * x1 + 3 * mt * t2 * x4 + t3 * x4
    const leftY = mt3 * y1 + 3 * mt2 * t * mid + 3 * mt * t2 * mid + t3 * y2
    leftPoints.push([leftX, leftY])

    // For right edge: P0=(x2,y1), P1=(x2,mid), P2=(x3,mid), P3=(x3,y2)
    const rightX = mt3 * x2 + 3 * mt2 * t * x2 + 3 * mt * t2 * x3 + t3 * x3
    const rightY = mt3 * y1 + 3 * mt2 * t * mid + 3 * mt * t2 * mid + t3 * y2
    rightPoints.push([rightX, rightY])
  }

  // Create triangles between left and right edges
  for (let i = 0; i < segments; i++) {
    const [lx1, ly1] = leftPoints[i]!
    const [lx2, ly2] = leftPoints[i + 1]!
    const [rx1, ry1] = rightPoints[i]!
    const [rx2, ry2] = rightPoints[i + 1]!

    // Two triangles per segment
    positions.push(lx1, ly1, rx1, ry1, lx2, ly2)
    positions.push(lx2, ly2, rx1, ry1, rx2, ry2)
  }

  return positions
}

/**
 * Build geometry with bezier curves
 */
export function buildBezierGeometry(
  featPositions: FeatPos[],
  offsets: number[],
  level: number,
  height: number,
  alpha: number,
  colorFn: (f: FeatPos, index: number) => [number, number, number],
  segments: number = 8,
): { positions: Float32Array; colors: Float32Array; featureIds: Float32Array } {
  const allPositions: number[] = []
  const allColors: number[] = []
  const allFeatureIds: number[] = []

  const y1 = 0
  const y2 = height

  for (let i = 0; i < featPositions.length; i++) {
    const feat = featPositions[i]!
    const { p11, p12, p21, p22 } = feat

    const x11 = p11.offsetPx - offsets[level]!
    const x12 = p12.offsetPx - offsets[level]!
    const x21 = p21.offsetPx - offsets[level + 1]!
    const x22 = p22.offsetPx - offsets[level + 1]!

    const [r, g, b] = colorFn(feat, i)
    const featureId = i + 1

    // Tessellate bezier box
    const positions = tessellateBezierBox(x11, x12, y1, x22, x21, y2, segments)

    const vertexCount = positions.length / 2
    for (let v = 0; v < vertexCount; v++) {
      allColors.push(r, g, b, alpha)
      allFeatureIds.push(featureId)
    }

    for (const p of positions) {
      allPositions.push(p)
    }
  }

  return {
    positions: new Float32Array(allPositions),
    colors: new Float32Array(allColors),
    featureIds: new Float32Array(allFeatureIds),
  }
}

/**
 * Example usage / integration test
 */
export function testWebGLRenderer() {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 200

  const renderer = new SyntenyWebGLRenderer()

  if (!renderer.init(canvas)) {
    console.log('WebGL2 not available')
    return null
  }

  // Create some test data
  const testFeatures: FeatPos[] = [
    {
      p11: { offsetPx: 100 },
      p12: { offsetPx: 200 },
      p21: { offsetPx: 150 },
      p22: { offsetPx: 250 },
      f: {
        get: (key: string) => (key === 'strand' ? 1 : 'chr1'),
        id: () => 'feat1',
      } as any,
      cigar: [],
    },
    {
      p11: { offsetPx: 300 },
      p12: { offsetPx: 400 },
      p21: { offsetPx: 350 },
      p22: { offsetPx: 450 },
      f: {
        get: (key: string) => (key === 'strand' ? -1 : 'chr2'),
        id: () => 'feat2',
      } as any,
      cigar: [],
    },
  ]

  const colorFn = createColorFunction('strand')
  renderer.buildGeometry(testFeatures, [0, 0], 0, 200, 0.5, colorFn)
  renderer.render()
  renderer.renderPicking()

  // Test picking
  const id1 = renderer.pick(150, 100)
  const id2 = renderer.pick(350, 100)
  const id3 = renderer.pick(10, 10) // Should be -1

  console.log('Pick results:', { id1, id2, id3 })

  return { canvas, renderer }
}
