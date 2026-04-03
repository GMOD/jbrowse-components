import {
  createPickingFbo,
  getDevicePixelRatio,
  resizeCanvas,
} from '@jbrowse/alignments-core'
import {
  bindUniformBlock,
  createProgram,
  enableStandardBlend,
} from '@jbrowse/core/gpu/webglUtils'

import { computeBlockRenderParams } from './multiSyntenyGpuData.ts'
import { YSCALEBAR_LABEL_OFFSET, niceNum } from '@jbrowse/alignments-core'
import {
  COVERAGE_VERTEX_SHADER,
  FILL_FRAGMENT_SHADER,
  FILL_VERTEX_SHADER,
  INSTANCE_BYTE_SIZE,
  UNIFORM_BYTE_SIZE,
  PICKING_FRAGMENT_SHADER,
  COVERAGE_BIN_BYTE_SIZE,
} from './multiSyntenyGpuShaders.ts'

import type { MultiSyntenyGpuBackend } from './multiSyntenyBackendTypes.ts'
import type { BlockGeometryData, BlockCoverageUploadData } from './multiSyntenyGpuData.ts'
import type { PickingFbo } from '@jbrowse/alignments-core'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

interface SyntenyGpuRegion {
  regionStart: number
  instanceVbo: WebGLBuffer | null
  instanceCount: number
  coverageVbo: WebGLBuffer | null
  coverageBinCount: number
  coverageMaxDepth: number
}

export class WebGLMultiSyntenyRenderer implements MultiSyntenyGpuBackend {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private fillProgram: WebGLProgram
  private pickingProgram: WebGLProgram
  private coverageProgram: WebGLProgram
  private fillVAO: WebGLVertexArrayObject
  private pickingVAO: WebGLVertexArrayObject
  private coverageVAO: WebGLVertexArrayObject
  private ubo: WebGLBuffer
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)

  private regions = new Map<string, SyntenyGpuRegion>()

  private pickingFboState: PickingFbo | undefined
  private pickingDirty = true
  private pickPixel = new Uint8Array(4)

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })
    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.fillProgram = createProgram(
      gl,
      FILL_VERTEX_SHADER,
      FILL_FRAGMENT_SHADER,
    )
    this.pickingProgram = createProgram(
      gl,
      FILL_VERTEX_SHADER,
      PICKING_FRAGMENT_SHADER,
    )
    this.coverageProgram = createProgram(
      gl,
      COVERAGE_VERTEX_SHADER,
      FILL_FRAGMENT_SHADER,
    )

    this.ubo = gl.createBuffer()!
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, UNIFORM_BYTE_SIZE, gl.DYNAMIC_DRAW)

    for (const program of [this.fillProgram, this.pickingProgram, this.coverageProgram]) {
      bindUniformBlock(gl, program, 'Uniforms', 0)
    }

    this.fillVAO = this.createInstancedVAO(this.fillProgram)
    this.pickingVAO = this.createInstancedVAO(this.pickingProgram)
    this.coverageVAO = this.createCoverageVAO()

    enableStandardBlend(gl)
  }

  private createInstancedVAO(program: WebGLProgram) {
    const gl = this.gl
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    for (const name of ['a_data0', 'a_color']) {
      const loc = gl.getAttribLocation(program, name)
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribDivisor(loc, 1)
      }
    }
    gl.bindVertexArray(null)
    return vao
  }

  private createCoverageVAO() {
    const gl = this.gl
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    for (const name of ['a_position', 'a_minDepth', 'a_maxDepth']) {
      const loc = gl.getAttribLocation(this.coverageProgram, name)
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribDivisor(loc, 1)
      }
    }
    gl.bindVertexArray(null)
    return vao
  }

  private bindInstanceBufferDirect(
    program: WebGLProgram,
    vbo: WebGLBuffer,
  ) {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)

    const dataLoc = gl.getAttribLocation(program, 'a_data0')
    if (dataLoc >= 0) {
      gl.vertexAttribIPointer(dataLoc, 4, gl.UNSIGNED_INT, INSTANCE_BYTE_SIZE, 0)
    }

    const colorLoc = gl.getAttribLocation(program, 'a_color')
    if (colorLoc >= 0) {
      gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, INSTANCE_BYTE_SIZE, 16)
    }
  }

  private bindCoverageBufferDirect(vbo: WebGLBuffer) {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)

    const posLoc = gl.getAttribLocation(this.coverageProgram, 'a_position')
    if (posLoc >= 0) {
      gl.vertexAttribPointer(posLoc, 1, gl.FLOAT, false, COVERAGE_BIN_BYTE_SIZE, 0)
    }

    const minLoc = gl.getAttribLocation(this.coverageProgram, 'a_minDepth')
    if (minLoc >= 0) {
      gl.vertexAttribPointer(minLoc, 1, gl.FLOAT, false, COVERAGE_BIN_BYTE_SIZE, 4)
    }

    const maxLoc = gl.getAttribLocation(this.coverageProgram, 'a_maxDepth')
    if (maxLoc >= 0) {
      gl.vertexAttribPointer(maxLoc, 1, gl.FLOAT, false, COVERAGE_BIN_BYTE_SIZE, 8)
    }
  }

  private getRegionForBlock(block: BaseBlock, regionKeyMap: Map<number, string>) {
    if (block.regionNumber === undefined) {
      return undefined
    }
    const key = regionKeyMap.get(block.regionNumber)
    if (!key) {
      return undefined
    }
    return this.regions.get(key)
  }

  resize(width: number, height: number) {
    const { pw, ph, changed } = resizeCanvas(this.canvas, width, height)
    if (changed) {
      this.pickingFboState = createPickingFbo(
        this.gl,
        pw,
        ph,
        this.pickingFboState,
      )
    }
  }

  uploadGeometryForBlock(
    blockKey: string,
    data: BlockGeometryData & { regionStart: number },
  ) {
    const gl = this.gl
    let region = this.regions.get(blockKey)

    if (region?.instanceVbo) {
      gl.deleteBuffer(region.instanceVbo)
    }

    if (data.instanceCount === 0) {
      if (region) {
        region.instanceVbo = null
        region.instanceCount = 0
      }
      return
    }

    if (!region) {
      region = {
        regionStart: data.regionStart,
        instanceVbo: null,
        instanceCount: 0,
        coverageVbo: null,
        coverageBinCount: 0,
        coverageMaxDepth: 0,
      }
      this.regions.set(blockKey, region)
    }

    region.regionStart = data.regionStart
    region.instanceVbo = gl.createBuffer()!
    region.instanceCount = data.instanceCount
    gl.bindBuffer(gl.ARRAY_BUFFER, region.instanceVbo)
    gl.bufferData(gl.ARRAY_BUFFER, data.buffer, gl.STATIC_DRAW)

    this.pickingDirty = true
  }

  uploadCoverageForBlock(
    blockKey: string,
    data: BlockCoverageUploadData & { regionStart: number; maxDepth: number },
  ) {
    const gl = this.gl
    let region = this.regions.get(blockKey)

    if (region?.coverageVbo) {
      gl.deleteBuffer(region.coverageVbo)
    }

    if (data.binCount === 0) {
      if (region) {
        region.coverageVbo = null
        region.coverageBinCount = 0
        region.coverageMaxDepth = data.maxDepth
      }
      return
    }

    if (!region) {
      region = {
        regionStart: data.regionStart,
        instanceVbo: null,
        instanceCount: 0,
        coverageVbo: null,
        coverageBinCount: 0,
        coverageMaxDepth: 0,
      }
      this.regions.set(blockKey, region)
    }

    region.coverageVbo = gl.createBuffer()!
    region.coverageBinCount = data.binCount
    region.coverageMaxDepth = data.maxDepth
    gl.bindBuffer(gl.ARRAY_BUFFER, region.coverageVbo)
    gl.bufferData(gl.ARRAY_BUFFER, data.buffer, gl.STATIC_DRAW)
  }

  clearBlock(blockKey: string) {
    const gl = this.gl
    const region = this.regions.get(blockKey)
    if (region) {
      if (region.instanceVbo) {
        gl.deleteBuffer(region.instanceVbo)
      }
      if (region.coverageVbo) {
        gl.deleteBuffer(region.coverageVbo)
      }
      this.regions.delete(blockKey)
    }
  }

  clearAllBlocks() {
    const gl = this.gl
    for (const region of this.regions.values()) {
      if (region.instanceVbo) {
        gl.deleteBuffer(region.instanceVbo)
      }
      if (region.coverageVbo) {
        gl.deleteBuffer(region.coverageVbo)
      }
    }
    this.regions.clear()
  }

  render(
    contentBlocks: BaseBlock[],
    regionKeyMap: Map<number, string>,
    viewOffsetPx: number,
    width: number,
    height: number,
    rowHeight: number,
    rowSpacing: boolean,
    coverageHeight: number,
    coverageColor?: [number, number, number],
  ) {
    const gl = this.gl

    this.resize(width, height)
    const dpr = getDevicePixelRatio()
    const logicalW = this.canvas.width / dpr
    const logicalH = this.canvas.height / dpr

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0.93, 0.93, 0.93, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const rowPadding = rowSpacing ? 1 : 0

    // Compute global niced max from all visible regions
    let globalMaxDepth = 0
    for (const block of contentBlocks) {
      const region = this.getRegionForBlock(block, regionKeyMap)
      if (region && region.coverageMaxDepth > globalMaxDepth) {
        globalMaxDepth = region.coverageMaxDepth
      }
    }
    const nicedMax = globalMaxDepth > 0 ? niceNum(globalMaxDepth) : 1
    const depthScale = globalMaxDepth > 0 ? globalMaxDepth / nicedMax : 1

    // Draw coverage first (behind synteny features)
    if (coverageHeight > 0) {
      gl.useProgram(this.coverageProgram)
      gl.bindVertexArray(this.coverageVAO)

      for (const block of contentBlocks) {
        const region = this.getRegionForBlock(block, regionKeyMap)
        if (!region?.coverageVbo || region.coverageBinCount === 0) {
          continue
        }

        const params = computeBlockRenderParams(block, viewOffsetPx)
        if (
          params.regionScreenLeft + params.regionScreenWidth < 0 ||
          params.regionScreenLeft > logicalW
        ) {
          continue
        }

        this.writeUniforms(
          logicalW, logicalH, rowHeight,
          params.bpRangeHi, params.bpRangeLo, params.bpRangeLen,
          params.regionScreenLeft, params.regionScreenWidth,
          rowPadding, coverageHeight, depthScale, coverageColor,
        )

        this.bindCoverageBufferDirect(region.coverageVbo)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, region.coverageBinCount)
      }

      gl.bindVertexArray(null)
    }

    // Draw synteny instances
    gl.useProgram(this.fillProgram)
    gl.bindVertexArray(this.fillVAO)

    for (const block of contentBlocks) {
      const region = this.getRegionForBlock(block, regionKeyMap)
      if (!region?.instanceVbo || region.instanceCount === 0) {
        continue
      }

      const params = computeBlockRenderParams(block, viewOffsetPx)
      if (
        params.regionScreenLeft + params.regionScreenWidth < 0 ||
        params.regionScreenLeft > logicalW
      ) {
        continue
      }

      this.writeUniforms(
        logicalW, logicalH, rowHeight,
        params.bpRangeHi, params.bpRangeLo, params.bpRangeLen,
        params.regionScreenLeft, params.regionScreenWidth,
        rowPadding, coverageHeight, depthScale, coverageColor,
      )

      this.bindInstanceBufferDirect(this.fillProgram, region.instanceVbo)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, region.instanceCount)
    }

    gl.bindVertexArray(null)
    this.pickingDirty = true
  }

  pick(_x: number, _y: number) {
    return -1
  }

  dispose() {
    const gl = this.gl
    this.clearAllBlocks()
    if (this.pickingFboState) {
      gl.deleteFramebuffer(this.pickingFboState.fbo)
      gl.deleteTexture(this.pickingFboState.colorTex)
    }
    gl.deleteVertexArray(this.fillVAO)
    gl.deleteVertexArray(this.pickingVAO)
    gl.deleteVertexArray(this.coverageVAO)
    gl.deleteBuffer(this.ubo)
    gl.deleteProgram(this.fillProgram)
    gl.deleteProgram(this.pickingProgram)
    gl.deleteProgram(this.coverageProgram)
  }

  private writeUniforms(
    width: number,
    height: number,
    rowHeight: number,
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLen: number,
    regionScreenLeft: number,
    regionScreenWidth: number,
    rowPadding: number,
    coverageHeight: number,
    depthScale: number,
    coverageColor?: [number, number, number],
  ) {
    const gl = this.gl
    const f = this.uniformF32
    f[0] = width
    f[1] = height
    f[2] = rowHeight
    f[3] = coverageHeight
    f[4] = bpRangeHi
    f[5] = bpRangeLo
    f[6] = bpRangeLen
    f[7] = regionScreenLeft
    f[8] = regionScreenWidth
    f[9] = 0
    f[10] = rowPadding
    f[11] = YSCALEBAR_LABEL_OFFSET
    f[12] = depthScale
    f[13] = coverageColor ? coverageColor[0] : 0.6
    f[14] = coverageColor ? coverageColor[1] : 0.6
    f[15] = coverageColor ? coverageColor[2] : 0.6

    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo)
  }
}
