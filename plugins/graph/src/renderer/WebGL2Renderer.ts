import type {
  RenderBatch,
  Renderer,
  SubBatch,
  TransformUniform,
} from './types.ts'

const vertexShaderSource = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_normal;
layout(location = 2) in float a_thickness;
layout(location = 3) in vec4 a_color;
uniform vec2 u_scale;
uniform vec2 u_translate;
uniform vec2 u_viewport;
out vec4 v_color;
void main() {
  vec2 expanded = a_position + a_normal * a_thickness / u_scale.x;
  vec2 screen = expanded * u_scale + u_translate;
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

interface SubBatchBuffers {
  vao: WebGLVertexArrayObject
  positionBuffer: WebGLBuffer
  normalBuffer: WebGLBuffer
  thicknessBuffer: WebGLBuffer
  colorBuffer: WebGLBuffer
  indexBuffer: WebGLBuffer
  indexCount: number
}

export class WebGL2Renderer implements Renderer {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private uScale: WebGLUniformLocation | null
  private uTranslate: WebGLUniformLocation | null
  private uViewport: WebGLUniformLocation | null
  private edgeBuffers: SubBatchBuffers | null = null
  private nodeBuffers: SubBatchBuffers | null = null
  private arrowBuffers: SubBatchBuffers | null = null

  constructor(canvas: HTMLCanvasElement) {
    // alpha:false gives an opaque canvas with no alpha channel, so
    // premultipliedAlpha is irrelevant — there is no transparency to composite.
    // Do NOT change alpha to true without also setting premultipliedAlpha:true
    // and verifying the blend/compositor math (see webgl2Hal.ts for details).
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

    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Shader link failed: ${gl.getProgramInfoLog(program)}`)
    }
    this.program = program

    this.uScale = gl.getUniformLocation(program, 'u_scale')
    this.uTranslate = gl.getUniformLocation(program, 'u_translate')
    this.uViewport = gl.getUniformLocation(program, 'u_viewport')

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
      throw new Error(`Shader compile failed: ${info}`)
    }
    return shader
  }

  private createSubBatchBuffers(batch: SubBatch): SubBatchBuffers {
    const gl = this.gl

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, batch.positions, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    const normalBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, batch.normals, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0)

    const thicknessBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, thicknessBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, batch.thicknesses, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0)

    const colorBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, batch.colors, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0)

    const indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, batch.indices, gl.STATIC_DRAW)

    gl.bindVertexArray(null)

    return {
      vao,
      positionBuffer,
      normalBuffer,
      thicknessBuffer,
      colorBuffer,
      indexBuffer,
      indexCount: batch.indices.length,
    }
  }

  private destroySubBatchBuffers(buffers: SubBatchBuffers) {
    const gl = this.gl
    gl.deleteVertexArray(buffers.vao)
    gl.deleteBuffer(buffers.positionBuffer)
    gl.deleteBuffer(buffers.normalBuffer)
    gl.deleteBuffer(buffers.thicknessBuffer)
    gl.deleteBuffer(buffers.colorBuffer)
    gl.deleteBuffer(buffers.indexBuffer)
  }

  resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1
    this.gl.canvas.width = width * dpr
    this.gl.canvas.height = height * dpr
    ;(this.gl.canvas as HTMLCanvasElement).style.width = `${width}px`
    ;(this.gl.canvas as HTMLCanvasElement).style.height = `${height}px`
    this.gl.viewport(0, 0, width * dpr, height * dpr)
  }

  uploadGeometry(batch: RenderBatch) {
    if (this.edgeBuffers) {
      this.destroySubBatchBuffers(this.edgeBuffers)
    }
    if (this.nodeBuffers) {
      this.destroySubBatchBuffers(this.nodeBuffers)
    }
    if (this.arrowBuffers) {
      this.destroySubBatchBuffers(this.arrowBuffers)
    }

    this.edgeBuffers =
      batch.edges.indices.length > 0
        ? this.createSubBatchBuffers(batch.edges)
        : null
    this.nodeBuffers =
      batch.nodes.indices.length > 0
        ? this.createSubBatchBuffers(batch.nodes)
        : null
    this.arrowBuffers =
      batch.arrows.indices.length > 0
        ? this.createSubBatchBuffers(batch.arrows)
        : null
  }

  updateSubBatchColors(
    target: 'edges' | 'nodes' | 'arrows',
    colors: Float32Array,
    vertexStart: number,
  ) {
    const buffers =
      target === 'edges'
        ? this.edgeBuffers
        : target === 'nodes'
          ? this.nodeBuffers
          : this.arrowBuffers
    if (!buffers) {
      return
    }
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.colorBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, vertexStart * 16, colors)
  }

  updateTransform(t: TransformUniform) {
    const gl = this.gl
    gl.useProgram(this.program)
    gl.uniform2f(this.uScale, t.scaleX, t.scaleY)
    gl.uniform2f(this.uTranslate, t.translateX, t.translateY)
    gl.uniform2f(this.uViewport, t.viewportWidth, t.viewportHeight)
  }

  render(clearColor: [number, number, number, number]) {
    const gl = this.gl

    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3])
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)

    for (const buffers of [
      this.edgeBuffers,
      this.nodeBuffers,
      this.arrowBuffers,
    ]) {
      if (buffers && buffers.indexCount > 0) {
        gl.bindVertexArray(buffers.vao)
        gl.drawElements(gl.TRIANGLES, buffers.indexCount, gl.UNSIGNED_INT, 0)
      }
    }
    gl.bindVertexArray(null)
  }

  destroy() {
    if (this.edgeBuffers) {
      this.destroySubBatchBuffers(this.edgeBuffers)
    }
    if (this.nodeBuffers) {
      this.destroySubBatchBuffers(this.nodeBuffers)
    }
    if (this.arrowBuffers) {
      this.destroySubBatchBuffers(this.arrowBuffers)
    }
    this.gl.deleteProgram(this.program)
  }
}
