// Render gridlines and background in WebGL
export class DotplotWebGLGrid {
  private gl: WebGL2RenderingContext | null = null
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private vertexCount = 0

  private uniformCache: Record<string, WebGLUniformLocation | null> = {}
  private allocatedBuffers: WebGLBuffer[] = []

  private readonly GRID_SHADER_VS = `#version 300 es
precision highp float;

in vec2 a_position;
in vec4 a_color;

uniform vec2 u_resolution;

out vec4 v_color;

void main() {
  vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  v_color = a_color;
}
`

  private readonly GRID_SHADER_FS = `#version 300 es
precision highp float;

in vec4 v_color;

out vec4 fragColor;

void main() {
  fragColor = v_color;
}
`

  init(gl: WebGL2RenderingContext): boolean {
    this.gl = gl
    try {
      const vs = this.createShader(gl.VERTEX_SHADER, this.GRID_SHADER_VS)
      const fs = this.createShader(gl.FRAGMENT_SHADER, this.GRID_SHADER_FS)
      this.program = this.createProgram(vs, fs)

      this.uniformCache.u_resolution = gl.getUniformLocation(this.program, 'u_resolution')

      return true
    } catch (e) {
      console.error('DotplotWebGLGrid init failed:', e)
      return false
    }
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl!
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader error: ${gl.getShaderInfoLog(shader)}`)
    }
    return shader
  }

  private createProgram(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
    const gl = this.gl!
    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program error: ${gl.getProgramInfoLog(program)}`)
    }
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    return program
  }

  buildGeometry(
    viewWidth: number,
    viewHeight: number,
    hblocks: Array<{ offsetPx: number }>,
    vblocks: Array<{ offsetPx: number }>,
    hviewOffset: number,
    vviewOffset: number,
    bgColor: string,
    gridColor: string,
  ) {
    if (!this.gl) return

    const gl = this.gl
    this.cleanup()

    const positions: number[] = []
    const colors: number[] = []

    // Parse colors
    const bgRgba = this.parseColor(bgColor)
    const gridRgba = this.parseColor(gridColor)

    // Background rectangle
    positions.push(0, 0, viewWidth, 0, viewWidth, viewHeight, 0, viewHeight)
    for (let i = 0; i < 4; i++) {
      colors.push(...bgRgba)
    }

    // Vertical gridlines
    for (const block of hblocks) {
      const x = block.offsetPx - hviewOffset
      if (x >= 0 && x <= viewWidth) {
        positions.push(x, 0, x, viewHeight)
        colors.push(...gridRgba, ...gridRgba)
      }
    }

    // Horizontal gridlines
    for (const block of vblocks) {
      const y = viewHeight - (block.offsetPx - vviewOffset)
      if (y >= 0 && y <= viewHeight) {
        positions.push(0, y, viewWidth, y)
        colors.push(...gridRgba, ...gridRgba)
      }
    }

    this.vertexCount = positions.length / 2

    if (this.vertexCount > 0) {
      const positionBuffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)
      this.allocatedBuffers.push(positionBuffer)

      const colorBuffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW)
      this.allocatedBuffers.push(colorBuffer)

      this.vao = gl.createVertexArray()!
      gl.bindVertexArray(this.vao)

      const posLoc = gl.getAttribLocation(this.program!, 'a_position')
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.enableVertexAttribArray(posLoc)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

      const colorLoc = gl.getAttribLocation(this.program!, 'a_color')
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
      gl.enableVertexAttribArray(colorLoc)
      gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0)

      gl.bindVertexArray(null)
    }
  }

  private parseColor(color: string): [number, number, number, number] {
    // Simple color parser - handles #RRGGBB and rgba(r,g,b,a)
    if (color.startsWith('#')) {
      const hex = color.slice(1)
      const r = parseInt(hex.slice(0, 2), 16) / 255
      const g = parseInt(hex.slice(2, 4), 16) / 255
      const b = parseInt(hex.slice(4, 6), 16) / 255
      return [r, g, b, 1]
    }
    // Default gray for grid
    return [0.8, 0.8, 0.8, 1]
  }

  render(viewWidth: number, viewHeight: number) {
    if (!this.gl || !this.vao || this.vertexCount === 0) return

    const gl = this.gl
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.uniform2f(this.uniformCache.u_resolution, viewWidth, viewHeight)

    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4) // Background rect
    gl.drawArrays(gl.LINES, 4, this.vertexCount - 4) // Gridlines
  }

  private cleanup() {
    if (!this.gl) return
    const gl = this.gl
    if (this.vao) {
      gl.deleteVertexArray(this.vao)
      this.vao = null
    }
    for (const buf of this.allocatedBuffers) {
      gl.deleteBuffer(buf)
    }
    this.allocatedBuffers = []
    this.vertexCount = 0
  }

  dispose() {
    this.cleanup()
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program)
    }
    this.gl = null
  }
}
