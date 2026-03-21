import type { Renderer, RenderBatch, TransformUniform } from './types.ts'

const vertexShaderSource = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec4 a_color;
uniform vec2 u_scale;
uniform vec2 u_translate;
uniform vec2 u_viewport;
out vec4 v_color;
void main() {
  vec2 screen = a_position * u_scale + u_translate;
  vec2 clip = (screen / u_viewport) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_color = a_color;
}
`

const fragmentShaderSource = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

export class WebGL2Renderer implements Renderer {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private uScale: WebGLUniformLocation | null
  private uTranslate: WebGLUniformLocation | null
  private uViewport: WebGLUniformLocation | null
  private vao: WebGLVertexArrayObject
  private positionBuffer: WebGLBuffer
  private colorBuffer: WebGLBuffer
  private indexBuffer: WebGLBuffer
  private indexCount = 0

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
    })
    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    const vs = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource)
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource)

    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Shader link failed: ' + gl.getProgramInfoLog(program))
    }
    this.program = program

    this.uScale = gl.getUniformLocation(program, 'u_scale')
    this.uTranslate = gl.getUniformLocation(program, 'u_translate')
    this.uViewport = gl.getUniformLocation(program, 'u_viewport')

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)

    this.positionBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    this.colorBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0)

    this.indexBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)

    gl.bindVertexArray(null)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  private compileShader(type: number, source: string) {
    const shader = this.gl.createShader(type)!
    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader)
      this.gl.deleteShader(shader)
      throw new Error('Shader compile failed: ' + info)
    }
    return shader
  }

  resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1
    this.gl.canvas.width = width * dpr
    this.gl.canvas.height = height * dpr
    ;(this.gl.canvas as HTMLCanvasElement).style.width = width + 'px'
    ;(this.gl.canvas as HTMLCanvasElement).style.height = height + 'px'
    this.gl.viewport(0, 0, width * dpr, height * dpr)
  }

  uploadGeometry(batch: RenderBatch) {
    const gl = this.gl

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, batch.positions, gl.DYNAMIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, batch.colors, gl.DYNAMIC_DRAW)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, batch.indices, gl.DYNAMIC_DRAW)

    this.indexCount = batch.indices.length
  }

  updateTransform(t: TransformUniform) {
    const gl = this.gl
    gl.useProgram(this.program)
    gl.uniform2f(this.uScale, t.scaleX, t.scaleY)
    gl.uniform2f(this.uTranslate, t.translateX, t.translateY)
    gl.uniform2f(this.uViewport, t.viewportWidth, t.viewportHeight)
  }

  render(clearColor: [number, number, number, number]) {
    if (this.indexCount === 0) {
      return
    }
    const gl = this.gl

    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3])
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)

    gl.bindVertexArray(this.vao)
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0)
    gl.bindVertexArray(null)
  }

  destroy() {
    this.gl.deleteVertexArray(this.vao)
    this.gl.deleteBuffer(this.positionBuffer)
    this.gl.deleteBuffer(this.colorBuffer)
    this.gl.deleteBuffer(this.indexBuffer)
    this.gl.deleteProgram(this.program)
  }
}
