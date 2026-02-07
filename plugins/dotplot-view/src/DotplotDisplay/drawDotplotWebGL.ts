import type { FeatPos } from './types.ts'

const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in vec4 a_color;

uniform vec2 u_viewSize;
uniform vec2 u_offset;

out vec4 v_color;

void main() {
  // Apply scroll offset then convert to NDC
  // u_offset represents the top-left corner of the viewport in absolute plot coordinates
  // Subtract offset to get position relative to viewport, then normalize to NDC
  vec2 relativePos = a_position - u_offset;
  float x = (relativePos.x / u_viewSize.x) * 2.0 - 1.0;
  float y = (relativePos.y / u_viewSize.y) * 2.0 - 1.0;

  gl_Position = vec4(x, -y, 0.0, 1.0);
  v_color = a_color;
}
`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 outColor;

void main() {
  outColor = v_color;
}
`

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (!success) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compilation failed: ${info}`)
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()
  if (!program) throw new Error('Failed to create program')

  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)

  const success = gl.getProgramParameter(program, gl.LINK_STATUS)
  if (!success) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program linking failed: ${info}`)
  }

  gl.deleteShader(vs)
  gl.deleteShader(fs)
  return program
}

export class DotplotWebGLRenderer {
  private gl: WebGL2RenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private vertexCount = 0
  private width = 0
  private height = 0

  init(canvas: HTMLCanvasElement) {
    console.log('DotplotWebGLRenderer.init: canvas.width=', canvas.width, 'canvas.height=', canvas.height)
    console.log('DotplotWebGLRenderer.init: canvas.clientWidth=', canvas.clientWidth, 'canvas.clientHeight=', canvas.clientHeight)

    const gl = canvas.getContext('webgl2')
    if (!gl) {
      console.error('Failed to get WebGL2 context')
      return false
    }

    this.canvas = canvas
    this.gl = gl
    this.width = canvas.width
    this.height = canvas.height

    try {
      this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(1, 1, 1, 1) // White background
      return true
    } catch (e) {
      console.error('WebGL init error:', e)
      return false
    }
  }

  buildGeometry(features: FeatPos[], colorFn: (f: FeatPos) => [number, number, number, number]) {
    if (!this.gl || !this.program) return

    const gl = this.gl

    // Build vertex data
    const positions: number[] = []
    const colors: number[] = []

    console.log('buildGeometry: processing', features.length, 'features')
    for (let i = 0; i < features.length; i++) {
      const feat = features[i]!
      const x1 = feat.x1.offsetPx
      const y1 = feat.y1.offsetPx
      const x2 = feat.x2.offsetPx
      const y2 = feat.y2.offsetPx
      const [r, g, b, a] = colorFn(feat)

      console.log(`Feature ${i}: (${x1}, ${y1}) -> (${x2}, ${y2})`, { r, g, b, a })

      // Start point
      positions.push(x1, y1)
      colors.push(r / 255, g / 255, b / 255, a / 255)

      // End point
      positions.push(x2, y2)
      colors.push(r / 255, g / 255, b / 255, a / 255)
    }

    this.vertexCount = positions.length / 2
    console.log('buildGeometry: total vertices=', this.vertexCount)

    if (this.vertexCount === 0) {
      console.log('buildGeometry: no vertices to render')
      return
    }

    // Clean up old VAO if it exists
    if (this.vao) {
      gl.deleteVertexArray(this.vao)
      this.vao = null
    }

    // Create new VAO
    const vao = gl.createVertexArray()
    if (!vao) {
      console.error('Failed to create VAO')
      return
    }
    gl.bindVertexArray(vao)

    // Position buffer
    const positionBuffer = gl.createBuffer()
    if (!positionBuffer) {
      console.error('Failed to create position buffer')
      return
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)

    const positionLoc = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(positionLoc)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

    // Color buffer
    const colorBuffer = gl.createBuffer()
    if (!colorBuffer) {
      console.error('Failed to create color buffer')
      return
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW)

    const colorLoc = gl.getAttribLocation(this.program, 'a_color')
    gl.enableVertexAttribArray(colorLoc)
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0)

    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    this.vao = vao

    console.log('buildGeometry: VAO created successfully with', this.vertexCount, 'vertices')
  }

  resize(width: number, height: number) {
    if (!this.gl) return
    if (this.width === width && this.height === height) return

    console.log('resize:', width, 'x', height)
    this.width = width
    this.height = height
    this.gl.viewport(0, 0, width, height)
  }

  render(offsetX: number, offsetY: number) {
    if (!this.gl) {
      console.warn('render: no GL context')
      return
    }
    if (!this.program) {
      console.warn('render: no program')
      return
    }
    if (!this.vao) {
      console.warn('render: no VAO')
      return
    }
    if (this.vertexCount === 0) {
      console.warn('render: no vertices')
      return
    }

    const gl = this.gl

    // Clear the canvas with light blue to see if it's rendering
    gl.clearColor(0.8, 0.9, 1.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Use program
    gl.useProgram(this.program)

    // Set uniforms
    const viewSizeLoc = gl.getUniformLocation(this.program, 'u_viewSize')
    gl.uniform2f(viewSizeLoc, this.width, this.height)

    const offsetLoc = gl.getUniformLocation(this.program, 'u_offset')
    gl.uniform2f(offsetLoc, offsetX, offsetY)

    // Render
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.LINES, 0, this.vertexCount)
    gl.bindVertexArray(null)

    console.log('render: SUCCESS - drew', this.vertexCount, 'vertices with offset', { offsetX, offsetY })
  }

  pick(x: number, y: number) {
    return -1
  }

  hasGeometry() {
    return this.vertexCount > 0
  }

  dispose() {
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program)
    }
    this.gl = null
  }
}
