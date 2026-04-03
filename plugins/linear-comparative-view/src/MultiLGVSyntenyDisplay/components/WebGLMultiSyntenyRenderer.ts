import {
  computeDepthScale,
  createPickingFbo,
  getDevicePixelRatio,
  resizeCanvas,
} from '@jbrowse/alignments-core'
import {
  bindUniformBlock,
  createProgram,
  enableStandardBlend,
} from '@jbrowse/core/gpu/webglUtils'

import {
  fillSyntenyUniforms,
  computeGlobalMaxDepth,
  getRegionForBlock,
  visibleBlocks,
} from './multiSyntenyGpuUtils.ts'
import {
  COVERAGE_VERTEX_SHADER,
  FILL_FRAGMENT_SHADER,
  FILL_VERTEX_SHADER,
  INSTANCE_BYTE_SIZE,
  UNIFORM_BYTE_SIZE,
  PICKING_FRAGMENT_SHADER,
  COVERAGE_BIN_BYTE_SIZE,
  GLSL_SNP_COVERAGE_VERTEX_SHADER,
} from './multiSyntenyGpuShaders.ts'
import { SNP_SEGMENT_BYTE_SIZE } from './multiSyntenyGpuData.ts'

import { BG_COLOR_GL } from './multiSyntenyBackendTypes.ts'
import type { MultiSyntenyGpuBackend } from './multiSyntenyBackendTypes.ts'
import type { BlockGeometryData, BlockCoverageUploadData, BlockSnpUploadData } from './multiSyntenyGpuData.ts'
import type { SyntenyColorPalette } from '../model.ts'
import type { PickingFbo } from '@jbrowse/alignments-core'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

interface SyntenyGpuRegion {
  regionStart: number
  instanceVbo: WebGLBuffer | null
  instanceCount: number
  coverageVbo: WebGLBuffer | null
  coverageBinCount: number
  coverageMaxDepth: number
  snpVbo: WebGLBuffer | null
  snpSegmentCount: number
}

export class WebGLMultiSyntenyRenderer implements MultiSyntenyGpuBackend {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private fillProgram: WebGLProgram
  private pickingProgram: WebGLProgram
  private coverageProgram: WebGLProgram
  private snpProgram: WebGLProgram
  private fillVAO: WebGLVertexArrayObject
  private pickingVAO: WebGLVertexArrayObject
  private coverageVAO: WebGLVertexArrayObject
  private snpVAO: WebGLVertexArrayObject
  private ubo: WebGLBuffer
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)

  private regions = new Map<number, SyntenyGpuRegion>()

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
    this.snpProgram = createProgram(
      gl,
      GLSL_SNP_COVERAGE_VERTEX_SHADER,
      FILL_FRAGMENT_SHADER,
    )

    this.ubo = gl.createBuffer()!
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, UNIFORM_BYTE_SIZE, gl.DYNAMIC_DRAW)

    for (const program of [this.fillProgram, this.pickingProgram, this.coverageProgram, this.snpProgram]) {
      bindUniformBlock(gl, program, 'Uniforms', 0)
    }

    this.fillVAO = this.createInstancedVAO(this.fillProgram)
    this.pickingVAO = this.createInstancedVAO(this.pickingProgram)
    this.coverageVAO = this.createCoverageVAO()
    this.snpVAO = this.createSnpVAO()

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

  private createSnpVAO() {
    const gl = this.gl
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    for (const name of ['a_position', 'a_yOffset', 'a_height', 'a_colorType']) {
      const loc = gl.getAttribLocation(this.snpProgram, name)
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribDivisor(loc, 1)
      }
    }
    gl.bindVertexArray(null)
    return vao
  }

  private bindSnpBufferDirect(vbo: WebGLBuffer) {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    const stride = SNP_SEGMENT_BYTE_SIZE
    const posLoc = gl.getAttribLocation(this.snpProgram, 'a_position')
    if (posLoc >= 0) {
      gl.vertexAttribPointer(posLoc, 1, gl.FLOAT, false, stride, 0)
    }
    const yLoc = gl.getAttribLocation(this.snpProgram, 'a_yOffset')
    if (yLoc >= 0) {
      gl.vertexAttribPointer(yLoc, 1, gl.FLOAT, false, stride, 4)
    }
    const hLoc = gl.getAttribLocation(this.snpProgram, 'a_height')
    if (hLoc >= 0) {
      gl.vertexAttribPointer(hLoc, 1, gl.FLOAT, false, stride, 8)
    }
    const cLoc = gl.getAttribLocation(this.snpProgram, 'a_colorType')
    if (cLoc >= 0) {
      gl.vertexAttribPointer(cLoc, 1, gl.FLOAT, false, stride, 12)
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

  private getOrCreateRegion(regionNumber: number, regionStart: number) {
    let region = this.regions.get(regionNumber)
    if (!region) {
      region = {
        regionStart,
        instanceVbo: null,
        instanceCount: 0,
        coverageVbo: null,
        coverageBinCount: 0,
        coverageMaxDepth: 0,
        snpVbo: null,
        snpSegmentCount: 0,
      }
      this.regions.set(regionNumber, region)
    }
    return region
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
    regionNumber: number,
    data: BlockGeometryData & { regionStart: number },
  ) {
    const gl = this.gl
    const existing = this.regions.get(regionNumber)

    if (existing?.instanceVbo) {
      gl.deleteBuffer(existing.instanceVbo)
    }

    if (data.instanceCount === 0) {
      if (existing) {
        existing.instanceVbo = null
        existing.instanceCount = 0
      }
      return
    }

    const region = this.getOrCreateRegion(regionNumber, data.regionStart)
    region.regionStart = data.regionStart
    region.instanceVbo = gl.createBuffer()!
    region.instanceCount = data.instanceCount
    gl.bindBuffer(gl.ARRAY_BUFFER, region.instanceVbo)
    gl.bufferData(gl.ARRAY_BUFFER, data.buffer, gl.STATIC_DRAW)

    this.pickingDirty = true
  }

  uploadCoverageForBlock(
    regionNumber: number,
    data: BlockCoverageUploadData & { regionStart: number; maxDepth: number },
  ) {
    const gl = this.gl
    const existing = this.regions.get(regionNumber)

    if (existing?.coverageVbo) {
      gl.deleteBuffer(existing.coverageVbo)
    }

    if (data.binCount === 0) {
      if (existing) {
        existing.coverageVbo = null
        existing.coverageBinCount = 0
        existing.coverageMaxDepth = data.maxDepth
      }
      return
    }

    const region = this.getOrCreateRegion(regionNumber, data.regionStart)
    region.coverageVbo = gl.createBuffer()!
    region.coverageBinCount = data.binCount
    region.coverageMaxDepth = data.maxDepth
    gl.bindBuffer(gl.ARRAY_BUFFER, region.coverageVbo)
    gl.bufferData(gl.ARRAY_BUFFER, data.buffer, gl.STATIC_DRAW)
  }

  uploadSnpCoverageForBlock(
    regionNumber: number,
    data: BlockSnpUploadData,
  ) {
    const gl = this.gl
    const existing = this.regions.get(regionNumber)

    if (existing?.snpVbo) {
      gl.deleteBuffer(existing.snpVbo)
    }

    if (data.segmentCount === 0) {
      if (existing) {
        existing.snpVbo = null
        existing.snpSegmentCount = 0
      }
      return
    }

    const region = this.regions.get(regionNumber)
    if (!region) {
      return
    }
    region.snpVbo = gl.createBuffer()!
    region.snpSegmentCount = data.segmentCount
    gl.bindBuffer(gl.ARRAY_BUFFER, region.snpVbo)
    gl.bufferData(gl.ARRAY_BUFFER, data.buffer, gl.STATIC_DRAW)
  }

  clearBlock(regionNumber: number) {
    const gl = this.gl
    const region = this.regions.get(regionNumber)
    if (region) {
      if (region.instanceVbo) {
        gl.deleteBuffer(region.instanceVbo)
      }
      if (region.coverageVbo) {
        gl.deleteBuffer(region.coverageVbo)
      }
      if (region.snpVbo) {
        gl.deleteBuffer(region.snpVbo)
      }
      this.regions.delete(regionNumber)
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
      if (region.snpVbo) {
        gl.deleteBuffer(region.snpVbo)
      }
    }
    this.regions.clear()
  }

  render(
    contentBlocks: BaseBlock[],
    viewOffsetPx: number,
    width: number,
    height: number,
    rowHeight: number,
    rowSpacing: boolean,
    coverageHeight: number,
    palette: SyntenyColorPalette,
  ) {
    const gl = this.gl

    this.resize(width, height)
    const dpr = getDevicePixelRatio()
    const logicalW = this.canvas.width / dpr
    const logicalH = this.canvas.height / dpr

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(BG_COLOR_GL, BG_COLOR_GL, BG_COLOR_GL, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const rowPadding = rowSpacing ? 1 : 0

    const lookup = (b: BaseBlock) =>
      getRegionForBlock(b, this.regions)
    const depthScale = computeDepthScale(
      computeGlobalMaxDepth(contentBlocks, lookup),
    )

    const iterBlocks = () => visibleBlocks(
      contentBlocks, this.regions, viewOffsetPx, logicalW,
    )

    // Draw coverage first (behind synteny features)
    if (coverageHeight > 0) {
      gl.useProgram(this.coverageProgram)
      gl.bindVertexArray(this.coverageVAO)

      for (const [region, params] of iterBlocks()) {
        if (!region.coverageVbo || region.coverageBinCount === 0) {
          continue
        }
        this.writeUniforms(
          logicalW, logicalH, rowHeight,
          params.bpRangeHi, params.bpRangeLo, params.bpRangeLen,
          params.regionScreenLeft, params.regionScreenWidth,
          rowPadding, coverageHeight, depthScale, palette,
        )
        this.bindCoverageBufferDirect(region.coverageVbo)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, region.coverageBinCount)
      }

      gl.bindVertexArray(null)
    }

    // Draw SNP coverage segments on top of grey coverage
    if (coverageHeight > 0) {
      gl.useProgram(this.snpProgram)
      gl.bindVertexArray(this.snpVAO)

      for (const [region, params] of iterBlocks()) {
        if (!region.snpVbo || region.snpSegmentCount === 0) {
          continue
        }
        this.writeUniforms(
          logicalW, logicalH, rowHeight,
          params.bpRangeHi, params.bpRangeLo, params.bpRangeLen,
          params.regionScreenLeft, params.regionScreenWidth,
          rowPadding, coverageHeight, depthScale, palette,
        )
        this.bindSnpBufferDirect(region.snpVbo)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, region.snpSegmentCount)
      }

      gl.bindVertexArray(null)
    }

    // Draw synteny instances
    gl.useProgram(this.fillProgram)
    gl.bindVertexArray(this.fillVAO)

    for (const [region, params] of iterBlocks()) {
      if (!region.instanceVbo || region.instanceCount === 0) {
        continue
      }
      this.writeUniforms(
        logicalW, logicalH, rowHeight,
        params.bpRangeHi, params.bpRangeLo, params.bpRangeLen,
        params.regionScreenLeft, params.regionScreenWidth,
        rowPadding, coverageHeight, depthScale, palette,
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
    gl.deleteVertexArray(this.snpVAO)
    gl.deleteBuffer(this.ubo)
    gl.deleteProgram(this.fillProgram)
    gl.deleteProgram(this.pickingProgram)
    gl.deleteProgram(this.coverageProgram)
    gl.deleteProgram(this.snpProgram)
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
    palette: SyntenyColorPalette,
  ) {
    const gl = this.gl
    fillSyntenyUniforms(
      this.uniformF32, width, height, rowHeight,
      bpRangeHi, bpRangeLo, bpRangeLen,
      regionScreenLeft, regionScreenWidth,
      rowPadding, coverageHeight, depthScale, palette,
    )
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo)
  }
}
