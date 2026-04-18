import { bindUniformBlock, createProgram } from '@jbrowse/core/gpu/webglUtils'

import * as graphShader from './shaders/graph.generated.ts'
import { SUB_BATCH_KEYS } from './types.ts'

import type {
  RenderBatch,
  Renderer,
  SubBatch,
  SubBatchKey,
  TransformUniform,
} from './types.ts'

const U = graphShader.UNIFORM_OFFSET_F32
const STRIDE_BYTES = graphShader.INSTANCE_STRIDE_BYTES
const STRIDE_F32 = graphShader.INSTANCE_STRIDE_F32
const COLOR_OFFSET_F32 = graphShader.FIELD_OFFSET_F32.color

interface SubBatchBuffers {
  vao: WebGLVertexArrayObject
  vbo: WebGLBuffer
  indexBuffer: WebGLBuffer
  // Independent copy of the batch's interleaved vertex data, aliased as u32
  // so the colour slot can be mutated without a second buffer. Owned by this
  // renderer so mutations don't leak back into the shared SubBatch.
  shadow: Uint32Array
  indexCount: number
}

export class WebGL2Renderer implements Renderer {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private ubo: WebGLBuffer
  private uniformData = new ArrayBuffer(graphShader.UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)
  private attrLocs: number[]
  private subBatches: Record<SubBatchKey, SubBatchBuffers | null> = {
    edges: null,
    nodes: null,
    arrows: null,
  }

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

    this.program = createProgram(
      gl,
      graphShader.GLSL_VERTEX,
      graphShader.GLSL_FRAGMENT,
    )
    bindUniformBlock(gl, this.program, 'Uniforms', 0)

    this.attrLocs = graphShader.GL_ATTRIBUTES.map(a =>
      gl.getAttribLocation(this.program, a.name),
    )

    this.ubo = gl.createBuffer()!
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferData(
      gl.UNIFORM_BUFFER,
      graphShader.UNIFORMS_SIZE_BYTES,
      gl.DYNAMIC_DRAW,
    )

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  private createSubBatchBuffers(batch: SubBatch): SubBatchBuffers {
    const gl = this.gl

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, batch.vertexData, gl.DYNAMIC_DRAW)

    for (let i = 0; i < graphShader.GL_ATTRIBUTES.length; i++) {
      const attr = graphShader.GL_ATTRIBUTES[i]!
      const loc = this.attrLocs[i]!
      if (loc < 0) {
        continue
      }
      gl.enableVertexAttribArray(loc)
      if (attr.integer) {
        const type = attr.type === 'int' ? gl.INT : gl.UNSIGNED_INT
        gl.vertexAttribIPointer(
          loc,
          attr.components,
          type,
          STRIDE_BYTES,
          attr.offsetBytes,
        )
      } else {
        gl.vertexAttribPointer(
          loc,
          attr.components,
          gl.FLOAT,
          false,
          STRIDE_BYTES,
          attr.offsetBytes,
        )
      }
    }

    const indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, batch.indices, gl.STATIC_DRAW)

    gl.bindVertexArray(null)

    return {
      vao,
      vbo,
      indexBuffer,
      shadow: batch.vertexDataU32.slice(),
      indexCount: batch.indices.length,
    }
  }

  private destroySubBatchBuffers(buffers: SubBatchBuffers) {
    const gl = this.gl
    gl.deleteVertexArray(buffers.vao)
    gl.deleteBuffer(buffers.vbo)
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
    for (const key of SUB_BATCH_KEYS) {
      const existing = this.subBatches[key]
      if (existing) {
        this.destroySubBatchBuffers(existing)
      }
      this.subBatches[key] =
        batch[key].indices.length > 0
          ? this.createSubBatchBuffers(batch[key])
          : null
    }
  }

  updateSubBatchColors(
    target: SubBatchKey,
    colors: Uint32Array,
    vertexStart: number,
  ) {
    const buffers = this.subBatches[target]
    if (!buffers) {
      return
    }
    const { shadow } = buffers
    const count = colors.length
    for (let i = 0; i < count; i++) {
      shadow[(vertexStart + i) * STRIDE_F32 + COLOR_OFFSET_F32] = colors[i]!
    }
    // Single strided upload over the affected range. The position / normal /
    // thickness bytes in `shadow` are unchanged from the initial upload, so
    // re-uploading them is harmless and cheaper than N per-vertex writes.
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vbo)
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      vertexStart * STRIDE_BYTES,
      shadow.subarray(
        vertexStart * STRIDE_F32,
        (vertexStart + count) * STRIDE_F32,
      ),
    )
  }

  updateTransform(t: TransformUniform) {
    const f32 = this.uniformF32
    f32[U.scale] = t.scaleX
    f32[U.scale + 1] = t.scaleY
    f32[U.translate] = t.translateX
    f32[U.translate + 1] = t.translateY
    f32[U.viewport] = t.viewportWidth
    f32[U.viewport + 1] = t.viewportHeight
    const gl = this.gl
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
  }

  render(clearColor: [number, number, number, number]) {
    const gl = this.gl

    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3])
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo)

    for (const key of SUB_BATCH_KEYS) {
      const buffers = this.subBatches[key]
      if (buffers && buffers.indexCount > 0) {
        gl.bindVertexArray(buffers.vao)
        gl.drawElements(gl.TRIANGLES, buffers.indexCount, gl.UNSIGNED_INT, 0)
      }
    }
    gl.bindVertexArray(null)
  }

  destroy() {
    for (const key of SUB_BATCH_KEYS) {
      const buffers = this.subBatches[key]
      if (buffers) {
        this.destroySubBatchBuffers(buffers)
        this.subBatches[key] = null
      }
    }
    this.gl.deleteBuffer(this.ubo)
    this.gl.deleteProgram(this.program)
  }
}
