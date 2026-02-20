/// <reference types="@webgpu/types" />

import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'
import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'

import { WebGLRenderer } from './WebGLRenderer.ts'
import { getChainBounds, toClipRect } from './chainOverlayUtils.ts'
import {
  arcColorPalette,
  arcLineColorPalette,
  sashimiColorPalette,
} from './shaders/arcShaders.ts'
import { splitPositionWithFrac } from './shaders/utils.ts'
import {
  GAP_WGSL,
  HARDCLIP_WGSL,
  INSERTION_WGSL,
  MISMATCH_WGSL,
  MODIFICATION_WGSL,
  SOFTCLIP_WGSL,
} from './wgsl/cigarShaders.ts'
import {
  ARC_CURVE_SEGMENTS,
  ARC_LINE_STRIDE,
  ARC_STRIDE,
  CLOUD_STRIDE,
  CONN_LINE_STRIDE,
  COVERAGE_STRIDE,
  GAP_STRIDE,
  HARDCLIP_STRIDE,
  INDICATOR_STRIDE,
  INSERTION_STRIDE,
  MISMATCH_STRIDE,
  MODIFICATION_STRIDE,
  MOD_COV_STRIDE,
  NONCOV_STRIDE,
  READ_STRIDE,
  SASHIMI_STRIDE,
  SNP_COV_STRIDE,
  SOFTCLIP_STRIDE,
  UNIFORM_SIZE,
  U_ARC_COLORS,
  U_ARC_LINE_COLORS,
  U_BIN_SIZE,
  U_BLOCK_START_PX,
  U_BLOCK_WIDTH,
  U_BP_HI,
  U_BP_LEN,
  U_BP_LO,
  U_CANVAS_H,
  U_CANVAS_W,
  U_CHAIN_MODE,
  U_CLOUD_COLOR_SCHEME,
  U_COLOR_BASE_A,
  U_COLOR_BASE_C,
  U_COLOR_BASE_G,
  U_COLOR_BASE_T,
  U_COLOR_COVERAGE,
  U_COLOR_DELETION,
  U_COLOR_FWD,
  U_COLOR_HARDCLIP,
  U_COLOR_INSERTION,
  U_COLOR_LONG_INSERT,
  U_COLOR_MOD_FWD,
  U_COLOR_MOD_REV,
  U_COLOR_NOSTRAND,
  U_COLOR_PAIR_LL,
  U_COLOR_PAIR_LR,
  U_COLOR_PAIR_RL,
  U_COLOR_PAIR_RR,
  U_COLOR_REV,
  U_COLOR_SCHEME,
  U_COLOR_SHORT_INSERT,
  U_COLOR_SKIP,
  U_COLOR_SOFTCLIP,
  U_COLOR_SUPPLEMENTARY,
  U_COV_HEIGHT,
  U_COV_OFFSET,
  U_COV_Y_OFFSET,
  U_DEPTH_SCALE,
  U_DOMAIN_END,
  U_DOMAIN_START,
  U_ERASE_MODE,
  U_FEAT_H,
  U_FEAT_SPACING,
  U_GRADIENT_HUE,
  U_HIGHLIGHT_IDX,
  U_HIGHLIGHT_ONLY,
  U_HP_ZERO,
  U_INSERT_LOWER,
  U_INSERT_UPPER,
  U_LINE_WIDTH_PX,
  U_NONCOV_HEIGHT,
  U_RANGE_Y0,
  U_REGION_START,
  U_SASHIMI_COLORS,
  U_SCROLL_TOP,
  U_SHOW_STROKE,
} from './wgsl/common.ts'
import {
  COVERAGE_WGSL,
  INDICATOR_WGSL,
  MOD_COVERAGE_WGSL,
  NONCOV_HISTOGRAM_WGSL,
  SNP_COVERAGE_WGSL,
} from './wgsl/coverageShaders.ts'
import {
  ARC_LINE_WGSL,
  ARC_WGSL,
  CLOUD_WGSL,
  CONNECTING_LINE_WGSL,
  FLAT_QUAD_WGSL,
  SASHIMI_WGSL,
} from './wgsl/miscShaders.ts'
import { READ_WGSL } from './wgsl/readShader.ts'

import type { RenderState } from './WebGLRenderer.ts'
export type { ColorPalette, RGBColor } from './WebGLRenderer.ts'
export type { RenderState } from './WebGLRenderer.ts'

interface GpuRegion {
  regionStart: number
  readBuffer: GPUBuffer | null
  readCount: number
  readBG: GPUBindGroup | null
  readPositions: Uint32Array
  readYs: Uint16Array
  readStrands: Int8Array
  coverageBuffer: GPUBuffer | null
  coverageCount: number
  coverageBG: GPUBindGroup | null
  maxDepth: number
  binSize: number
  snpCovBuffer: GPUBuffer | null
  snpCovCount: number
  snpCovBG: GPUBindGroup | null
  noncovBuffer: GPUBuffer | null
  noncovCount: number
  noncovBG: GPUBindGroup | null
  noncovMaxCount: number
  indicatorBuffer: GPUBuffer | null
  indicatorCount: number
  indicatorBG: GPUBindGroup | null
  gapBuffer: GPUBuffer | null
  gapCount: number
  gapBG: GPUBindGroup | null
  mismatchBuffer: GPUBuffer | null
  mismatchCount: number
  mismatchBG: GPUBindGroup | null
  insertionBuffer: GPUBuffer | null
  insertionCount: number
  insertionBG: GPUBindGroup | null
  softclipBuffer: GPUBuffer | null
  softclipCount: number
  softclipBG: GPUBindGroup | null
  hardclipBuffer: GPUBuffer | null
  hardclipCount: number
  hardclipBG: GPUBindGroup | null
  modBuffer: GPUBuffer | null
  modCount: number
  modBG: GPUBindGroup | null
  modCovBuffer: GPUBuffer | null
  modCovCount: number
  modCovBG: GPUBindGroup | null
  arcBuffer: GPUBuffer | null
  arcCount: number
  arcBG: GPUBindGroup | null
  arcLineBuffer: GPUBuffer | null
  arcLineCount: number
  arcLineBG: GPUBindGroup | null
  sashimiBuffer: GPUBuffer | null
  sashimiCount: number
  sashimiBG: GPUBindGroup | null
  cloudBuffer: GPUBuffer | null
  cloudCount: number
  cloudBG: GPUBindGroup | null
  connLineBuffer: GPUBuffer | null
  connLineCount: number
  connLineBG: GPUBindGroup | null
  insertSizeStats?: { upper: number; lower: number }
}

const cache = new WeakMap<HTMLCanvasElement, AlignmentsRenderer>()

export class AlignmentsRenderer {
  private static device: GPUDevice | null = null
  private static layout: GPUBindGroupLayout | null = null
  private static readPL: GPURenderPipeline | null = null
  private static gapPL: GPURenderPipeline | null = null
  private static mismatchPL: GPURenderPipeline | null = null
  private static insertionPL: GPURenderPipeline | null = null
  private static softclipPL: GPURenderPipeline | null = null
  private static hardclipPL: GPURenderPipeline | null = null
  private static modPL: GPURenderPipeline | null = null
  private static coveragePL: GPURenderPipeline | null = null
  private static snpCovPL: GPURenderPipeline | null = null
  private static modCovPL: GPURenderPipeline | null = null
  private static noncovPL: GPURenderPipeline | null = null
  private static indicatorPL: GPURenderPipeline | null = null
  private static arcPL: GPURenderPipeline | null = null
  private static arcLinePL: GPURenderPipeline | null = null
  private static sashimiPL: GPURenderPipeline | null = null
  private static cloudPL: GPURenderPipeline | null = null
  private static connLinePL: GPURenderPipeline | null = null
  private static flatQuadPL: GPURenderPipeline | null = null

  private canvas: HTMLCanvasElement
  private ctx: GPUCanvasContext | null = null
  private uBuf: GPUBuffer | null = null
  private uData = new ArrayBuffer(UNIFORM_SIZE)
  private uF32 = new Float32Array(this.uData)
  private uU32 = new Uint32Array(this.uData)
  private uI32 = new Int32Array(this.uData)
  private regions = new Map<number, GpuRegion>()
  glFallback: WebGLRenderer | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let r = cache.get(canvas)
    if (!r) {
      r = new AlignmentsRenderer(canvas)
      cache.set(canvas, r)
    }
    return r
  }

  private static async ensureDevice() {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    if (AlignmentsRenderer.device !== device) {
      AlignmentsRenderer.device = device
      AlignmentsRenderer.initPipelines(device)
    }
    return device
  }

  private static initPipelines(device: GPUDevice) {
    const blend: GPUBlendState = {
      color: {
        srcFactor: 'src-alpha',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
      alpha: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
    }
    const target: GPUColorTargetState = { format: 'bgra8unorm', blend }
    AlignmentsRenderer.layout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    })
    const pLayout = device.createPipelineLayout({
      bindGroupLayouts: [AlignmentsRenderer.layout],
    })

    const mkPL = (
      code: string,
      topo: GPUPrimitiveTopology = 'triangle-list',
    ) => {
      const mod = device.createShaderModule({ code })
      return device.createRenderPipeline({
        layout: pLayout,
        vertex: { module: mod, entryPoint: 'vs_main' },
        fragment: { module: mod, entryPoint: 'fs_main', targets: [target] },
        primitive: {
          topology: topo,
          ...(topo === 'triangle-strip'
            ? { stripIndexFormat: 'uint32' as GPUIndexFormat }
            : {}),
        },
      })
    }

    AlignmentsRenderer.readPL = mkPL(READ_WGSL)
    AlignmentsRenderer.gapPL = mkPL(GAP_WGSL)
    AlignmentsRenderer.mismatchPL = mkPL(MISMATCH_WGSL)
    AlignmentsRenderer.insertionPL = mkPL(INSERTION_WGSL)
    AlignmentsRenderer.softclipPL = mkPL(SOFTCLIP_WGSL)
    AlignmentsRenderer.hardclipPL = mkPL(HARDCLIP_WGSL)
    AlignmentsRenderer.modPL = mkPL(MODIFICATION_WGSL)
    AlignmentsRenderer.coveragePL = mkPL(COVERAGE_WGSL)
    AlignmentsRenderer.snpCovPL = mkPL(SNP_COVERAGE_WGSL)
    AlignmentsRenderer.modCovPL = mkPL(MOD_COVERAGE_WGSL)
    AlignmentsRenderer.noncovPL = mkPL(NONCOV_HISTOGRAM_WGSL)
    AlignmentsRenderer.indicatorPL = mkPL(INDICATOR_WGSL)
    AlignmentsRenderer.arcPL = mkPL(ARC_WGSL, 'triangle-strip')
    AlignmentsRenderer.arcLinePL = mkPL(ARC_LINE_WGSL, 'line-list')
    AlignmentsRenderer.sashimiPL = mkPL(SASHIMI_WGSL, 'triangle-strip')
    AlignmentsRenderer.cloudPL = mkPL(CLOUD_WGSL)
    AlignmentsRenderer.connLinePL = mkPL(CONNECTING_LINE_WGSL)
    AlignmentsRenderer.flatQuadPL = mkPL(FLAT_QUAD_WGSL)
  }

  async init() {
    const device = await AlignmentsRenderer.ensureDevice()
    if (device) {
      const result = await initGpuContext(this.canvas)
      if (result) {
        this.ctx = result.context
        this.uBuf = device.createBuffer({
          size: UNIFORM_SIZE,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        return true
      }
    }
    try {
      this.glFallback = new WebGLRenderer(this.canvas)
      return true
    } catch (e) {
      console.error('[AlignmentsRenderer] WebGL2 fallback also failed:', e)
      return false
    }
  }

  private mkBuf(device: GPUDevice, data: ArrayBuffer) {
    const buf = device.createBuffer({
      size: Math.max(data.byteLength, 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(buf, 0, data)
    return buf
  }

  private mkBG(device: GPUDevice, storage: GPUBuffer) {
    return device.createBindGroup({
      layout: AlignmentsRenderer.layout!,
      entries: [
        { binding: 0, resource: { buffer: storage } },
        { binding: 1, resource: { buffer: this.uBuf! } },
      ],
    })
  }

  private destroyRegion(r: GpuRegion) {
    r.readBuffer?.destroy()
    r.coverageBuffer?.destroy()
    r.snpCovBuffer?.destroy()
    r.noncovBuffer?.destroy()
    r.indicatorBuffer?.destroy()
    r.gapBuffer?.destroy()
    r.mismatchBuffer?.destroy()
    r.insertionBuffer?.destroy()
    r.softclipBuffer?.destroy()
    r.hardclipBuffer?.destroy()
    r.modBuffer?.destroy()
    r.modCovBuffer?.destroy()
    r.arcBuffer?.destroy()
    r.arcLineBuffer?.destroy()
    r.sashimiBuffer?.destroy()
    r.cloudBuffer?.destroy()
    r.connLineBuffer?.destroy()
  }

  private emptyRegion(regionStart: number): GpuRegion {
    return {
      regionStart,
      readBuffer: null,
      readCount: 0,
      readBG: null,
      readPositions: new Uint32Array(0),
      readYs: new Uint16Array(0),
      readStrands: new Int8Array(0),
      coverageBuffer: null,
      coverageCount: 0,
      coverageBG: null,
      maxDepth: 0,
      binSize: 1,
      snpCovBuffer: null,
      snpCovCount: 0,
      snpCovBG: null,
      noncovBuffer: null,
      noncovCount: 0,
      noncovBG: null,
      noncovMaxCount: 0,
      indicatorBuffer: null,
      indicatorCount: 0,
      indicatorBG: null,
      gapBuffer: null,
      gapCount: 0,
      gapBG: null,
      mismatchBuffer: null,
      mismatchCount: 0,
      mismatchBG: null,
      insertionBuffer: null,
      insertionCount: 0,
      insertionBG: null,
      softclipBuffer: null,
      softclipCount: 0,
      softclipBG: null,
      hardclipBuffer: null,
      hardclipCount: 0,
      hardclipBG: null,
      modBuffer: null,
      modCount: 0,
      modBG: null,
      modCovBuffer: null,
      modCovCount: 0,
      modCovBG: null,
      arcBuffer: null,
      arcCount: 0,
      arcBG: null,
      arcLineBuffer: null,
      arcLineCount: 0,
      arcLineBG: null,
      sashimiBuffer: null,
      sashimiCount: 0,
      sashimiBG: null,
      cloudBuffer: null,
      cloudCount: 0,
      cloudBG: null,
      connLineBuffer: null,
      connLineCount: 0,
      connLineBG: null,
    }
  }

  private getOrCreateRegion(regionNumber: number, regionStart: number) {
    let r = this.regions.get(regionNumber)
    if (!r) {
      r = this.emptyRegion(regionStart)
      this.regions.set(regionNumber, r)
    }
    return r
  }

  clearLegacyBuffers() {
    if (this.glFallback) {
      this.glFallback.clearLegacyBuffers()
      return
    }
    for (const r of this.regions.values()) {
      this.destroyRegion(r)
    }
    this.regions.clear()
  }

  ensureBuffers(regionStart: number) {
    if (this.glFallback) {
      this.glFallback.ensureBuffers(regionStart)
      return
    }
  }

  uploadFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadFromTypedArrays']>[0],
  ) {
    if (this.glFallback) {
      this.glFallback.uploadFromTypedArraysForRegion(regionNumber, data)
      return
    }
    const device = AlignmentsRenderer.device
    if (!device) {
      return
    }
    const old = this.regions.get(regionNumber)
    if (old) {
      this.destroyRegion(old)
    }
    const r = this.emptyRegion(data.regionStart)
    r.insertSizeStats = data.insertSizeStats
    r.readPositions = data.readPositions
    r.readYs = data.readYs
    r.readStrands = data.readStrands
    if (data.numReads > 0) {
      const n = data.numReads
      const buf = new ArrayBuffer(n * READ_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      const i32 = new Int32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * READ_STRIDE
        u32[o] = data.readPositions[i * 2]!
        u32[o + 1] = data.readPositions[i * 2 + 1]!
        u32[o + 2] = data.readYs[i]!
        u32[o + 3] = data.readFlags[i]!
        u32[o + 4] = data.readMapqs[i]!
        f32[o + 5] = data.readInsertSizes[i]!
        u32[o + 6] = data.readPairOrientations[i]!
        i32[o + 7] = data.readStrands[i]!
        f32[o + 8] =
          data.readTagColors.length > 0 ? data.readTagColors[i * 3]! / 255 : 0
        f32[o + 9] =
          data.readTagColors.length > 0
            ? data.readTagColors[i * 3 + 1]! / 255
            : 0
        f32[o + 10] =
          data.readTagColors.length > 0
            ? data.readTagColors[i * 3 + 2]! / 255
            : 0
        u32[o + 11] = data.readChainHasSupp?.[i] ?? 0
      }
      r.readBuffer = this.mkBuf(device, buf)
      r.readBG = this.mkBG(device, r.readBuffer)
      r.readCount = n
    }
    this.regions.set(regionNumber, r)
  }

  uploadCigarFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadCigarFromTypedArrays']>[0],
  ) {
    if (this.glFallback) {
      this.glFallback.uploadCigarFromTypedArraysForRegion(regionNumber, data)
      return
    }
    const device = AlignmentsRenderer.device
    if (!device) {
      return
    }
    const r = this.regions.get(regionNumber)
    if (!r) {
      return
    }

    r.gapBuffer?.destroy()
    r.gapBG = null
    r.gapCount = 0
    r.mismatchBuffer?.destroy()
    r.mismatchBG = null
    r.mismatchCount = 0
    r.insertionBuffer?.destroy()
    r.insertionBG = null
    r.insertionCount = 0
    r.softclipBuffer?.destroy()
    r.softclipBG = null
    r.softclipCount = 0
    r.hardclipBuffer?.destroy()
    r.hardclipBG = null
    r.hardclipCount = 0

    if (data.numGaps > 0) {
      const buf = new ArrayBuffer(data.numGaps * GAP_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < data.numGaps; i++) {
        const o = i * GAP_STRIDE
        u32[o] = data.gapPositions[i * 2]!
        u32[o + 1] = data.gapPositions[i * 2 + 1]!
        u32[o + 2] = data.gapYs[i]!
        u32[o + 3] = data.gapTypes[i]!
        f32[o + 4] = data.gapFrequencies[i]! / 255
      }
      r.gapBuffer = this.mkBuf(device, buf)
      r.gapBG = this.mkBG(device, r.gapBuffer)
      r.gapCount = data.numGaps
    }

    if (data.numMismatches > 0) {
      const buf = new ArrayBuffer(data.numMismatches * MISMATCH_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < data.numMismatches; i++) {
        const o = i * MISMATCH_STRIDE
        u32[o] = data.mismatchPositions[i]!
        u32[o + 1] = data.mismatchYs[i]!
        u32[o + 2] = data.mismatchBases[i]!
        f32[o + 3] = data.mismatchFrequencies[i]! / 255
      }
      r.mismatchBuffer = this.mkBuf(device, buf)
      r.mismatchBG = this.mkBG(device, r.mismatchBuffer)
      r.mismatchCount = data.numMismatches
    }

    const insIdx: number[] = []
    const scIdx: number[] = []
    const hcIdx: number[] = []
    for (let i = 0; i < data.numInterbases; i++) {
      const t = data.interbaseTypes[i]
      if (t === 1) {
        insIdx.push(i)
      } else if (t === 2) {
        scIdx.push(i)
      } else if (t === 3) {
        hcIdx.push(i)
      }
    }

    const uploadClip = (indices: number[], stride: number) => {
      if (indices.length === 0) {
        return { buffer: null, bg: null, count: 0 }
      }
      const buf = new ArrayBuffer(indices.length * stride * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (const [j, index] of indices.entries()) {
        const i = index
        const o = j * stride
        u32[o] = data.interbasePositions[i]!
        u32[o + 1] = data.interbaseYs[i]!
        u32[o + 2] = data.interbaseLengths[i]!
        f32[o + 3] = data.interbaseFrequencies[i]! / 255
      }
      const gpuBuf = this.mkBuf(device, buf)
      return {
        buffer: gpuBuf,
        bg: this.mkBG(device, gpuBuf),
        count: indices.length,
      }
    }

    const ins = uploadClip(insIdx, INSERTION_STRIDE)
    r.insertionBuffer = ins.buffer
    r.insertionBG = ins.bg
    r.insertionCount = ins.count
    const sc = uploadClip(scIdx, SOFTCLIP_STRIDE)
    r.softclipBuffer = sc.buffer
    r.softclipBG = sc.bg
    r.softclipCount = sc.count
    const hc = uploadClip(hcIdx, HARDCLIP_STRIDE)
    r.hardclipBuffer = hc.buffer
    r.hardclipBG = hc.bg
    r.hardclipCount = hc.count
  }

  uploadModificationsFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadModificationsFromTypedArrays']>[0],
  ) {
    if (this.glFallback) {
      this.glFallback.uploadModificationsFromTypedArraysForRegion(
        regionNumber,
        data,
      )
      return
    }
    const device = AlignmentsRenderer.device
    if (!device) {
      return
    }
    const r = this.regions.get(regionNumber)
    if (!r) {
      return
    }
    r.modBuffer?.destroy()
    r.modBG = null
    r.modCount = 0
    if (data.numModifications > 0) {
      const n = data.numModifications
      const buf = new ArrayBuffer(n * MODIFICATION_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * MODIFICATION_STRIDE
        u32[o] = data.modificationPositions[i]!
        u32[o + 1] = data.modificationYs[i]!
        const ci = i * 4
        u32[o + 2] =
          data.modificationColors[ci]! |
          (data.modificationColors[ci + 1]! << 8) |
          (data.modificationColors[ci + 2]! << 16) |
          (data.modificationColors[ci + 3]! << 24)
        u32[o + 3] = 0
      }
      r.modBuffer = this.mkBuf(device, buf)
      r.modBG = this.mkBG(device, r.modBuffer)
      r.modCount = n
    }
  }

  uploadCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadCoverageFromTypedArrays']>[0],
  ) {
    if (this.glFallback) {
      this.glFallback.uploadCoverageFromTypedArraysForRegion(regionNumber, data)
      return
    }
    const device = AlignmentsRenderer.device
    if (!device) {
      return
    }
    const r = this.regions.get(regionNumber)
    if (!r) {
      return
    }

    r.coverageBuffer?.destroy()
    r.coverageBG = null
    r.coverageCount = 0
    r.snpCovBuffer?.destroy()
    r.snpCovBG = null
    r.snpCovCount = 0
    r.noncovBuffer?.destroy()
    r.noncovBG = null
    r.noncovCount = 0
    r.indicatorBuffer?.destroy()
    r.indicatorBG = null
    r.indicatorCount = 0

    if (data.numCoverageBins > 0) {
      const n = data.numCoverageBins
      const buf = new ArrayBuffer(n * COVERAGE_STRIDE * 4)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        f32[i * 2] = data.coverageStartOffset + i * data.coverageBinSize
        f32[i * 2 + 1] = (data.coverageDepths[i] ?? 0) / data.coverageMaxDepth
      }
      r.coverageBuffer = this.mkBuf(device, buf)
      r.coverageBG = this.mkBG(device, r.coverageBuffer)
      r.coverageCount = n
      r.maxDepth = data.coverageMaxDepth
      r.binSize = data.coverageBinSize
    }

    if (data.numSnpSegments > 0) {
      const n = data.numSnpSegments
      const buf = new ArrayBuffer(n * SNP_COV_STRIDE * 4)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * SNP_COV_STRIDE
        f32[o] = data.snpPositions[i]!
        f32[o + 1] = data.snpYOffsets[i]!
        f32[o + 2] = data.snpHeights[i]!
        f32[o + 3] = data.snpColorTypes[i]!
      }
      r.snpCovBuffer = this.mkBuf(device, buf)
      r.snpCovBG = this.mkBG(device, r.snpCovBuffer)
      r.snpCovCount = n
    }

    if (data.numNoncovSegments > 0) {
      const n = data.numNoncovSegments
      const buf = new ArrayBuffer(n * NONCOV_STRIDE * 4)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * NONCOV_STRIDE
        f32[o] = data.noncovPositions[i]!
        f32[o + 1] = data.noncovYOffsets[i]!
        f32[o + 2] = data.noncovHeights[i]!
        f32[o + 3] = data.noncovColorTypes[i]!
      }
      r.noncovBuffer = this.mkBuf(device, buf)
      r.noncovBG = this.mkBG(device, r.noncovBuffer)
      r.noncovCount = n
      r.noncovMaxCount = data.noncovMaxCount
    }

    if (data.numIndicators > 0) {
      const n = data.numIndicators
      const buf = new ArrayBuffer(n * INDICATOR_STRIDE * 4)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        f32[i * 2] = data.indicatorPositions[i]!
        f32[i * 2 + 1] = data.indicatorColorTypes[i]!
      }
      r.indicatorBuffer = this.mkBuf(device, buf)
      r.indicatorBG = this.mkBG(device, r.indicatorBuffer)
      r.indicatorCount = n
    }
  }

  uploadModCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadModCoverageFromTypedArrays']>[0],
  ) {
    if (this.glFallback) {
      this.glFallback.uploadModCoverageFromTypedArraysForRegion(
        regionNumber,
        data,
      )
      return
    }
    const device = AlignmentsRenderer.device
    if (!device) {
      return
    }
    const r = this.regions.get(regionNumber)
    if (!r) {
      return
    }
    r.modCovBuffer?.destroy()
    r.modCovBG = null
    r.modCovCount = 0
    if (data.numModCovSegments > 0) {
      const n = data.numModCovSegments
      const buf = new ArrayBuffer(n * MOD_COV_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * MOD_COV_STRIDE
        f32[o] = data.modCovPositions[i]!
        f32[o + 1] = data.modCovYOffsets[i]!
        f32[o + 2] = data.modCovHeights[i]!
        const ci = i * 4
        u32[o + 3] =
          data.modCovColors[ci]! |
          (data.modCovColors[ci + 1]! << 8) |
          (data.modCovColors[ci + 2]! << 16) |
          (data.modCovColors[ci + 3]! << 24)
      }
      r.modCovBuffer = this.mkBuf(device, buf)
      r.modCovBG = this.mkBG(device, r.modCovBuffer)
      r.modCovCount = n
    }
  }

  uploadSashimiFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadSashimiFromTypedArrays']>[0],
  ) {
    if (this.glFallback) {
      this.glFallback.uploadSashimiFromTypedArraysForRegion(regionNumber, data)
      return
    }
    const device = AlignmentsRenderer.device
    if (!device) {
      return
    }
    const r = this.regions.get(regionNumber)
    if (!r) {
      return
    }
    r.sashimiBuffer?.destroy()
    r.sashimiBG = null
    r.sashimiCount = 0
    if (data.numSashimiArcs > 0) {
      const n = data.numSashimiArcs
      const buf = new ArrayBuffer(n * SASHIMI_STRIDE * 4)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * SASHIMI_STRIDE
        f32[o] = data.sashimiX1[i]!
        f32[o + 1] = data.sashimiX2[i]!
        f32[o + 2] = data.sashimiColorTypes[i]!
        f32[o + 3] = data.sashimiScores[i]!
      }
      r.sashimiBuffer = this.mkBuf(device, buf)
      r.sashimiBG = this.mkBG(device, r.sashimiBuffer)
      r.sashimiCount = n
    }
  }

  uploadArcsFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadArcsFromTypedArrays']>[0],
  ) {
    if (this.glFallback) {
      this.glFallback.uploadArcsFromTypedArraysForRegion(regionNumber, data)
      return
    }
    const device = AlignmentsRenderer.device
    if (!device) {
      return
    }
    let r = this.regions.get(regionNumber)
    if (!r) {
      r = this.getOrCreateRegion(regionNumber, data.regionStart)
    }
    r.arcBuffer?.destroy()
    r.arcBG = null
    r.arcCount = 0
    r.arcLineBuffer?.destroy()
    r.arcLineBG = null
    r.arcLineCount = 0

    if (data.numArcs > 0) {
      const n = data.numArcs
      const buf = new ArrayBuffer(n * ARC_STRIDE * 4)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * ARC_STRIDE
        f32[o] = data.arcX1[i]!
        f32[o + 1] = data.arcX2[i]!
        f32[o + 2] = data.arcColorTypes[i]!
        f32[o + 3] = data.arcIsArc[i]!
      }
      r.arcBuffer = this.mkBuf(device, buf)
      r.arcBG = this.mkBG(device, r.arcBuffer)
      r.arcCount = n
    }

    if (data.numLines > 0) {
      const n = data.numLines
      const buf = new ArrayBuffer(n * ARC_LINE_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * ARC_LINE_STRIDE
        u32[o] = data.linePositions[i]!
        f32[o + 1] = data.lineYs[i]!
        f32[o + 2] = data.lineColorTypes[i]!
        f32[o + 3] = 0
      }
      r.arcLineBuffer = this.mkBuf(device, buf)
      r.arcLineBG = this.mkBG(device, r.arcLineBuffer)
      r.arcLineCount = n
    }
  }

  uploadCloudFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadCloudFromTypedArrays']>[0],
  ) {
    if (this.glFallback) {
      this.glFallback.uploadCloudFromTypedArraysForRegion(regionNumber, data)
      return
    }
    const device = AlignmentsRenderer.device
    if (!device) {
      return
    }
    let r = this.regions.get(regionNumber)
    if (!r) {
      r = this.getOrCreateRegion(regionNumber, data.regionStart)
    }
    r.cloudBuffer?.destroy()
    r.cloudBG = null
    r.cloudCount = 0
    if (data.numChains > 0) {
      const n = data.numChains
      const buf = new ArrayBuffer(n * CLOUD_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * CLOUD_STRIDE
        u32[o] = data.chainPositions[i * 2]!
        u32[o + 1] = data.chainPositions[i * 2 + 1]!
        f32[o + 2] = data.chainYs[i]!
        f32[o + 3] = data.chainFlags[i]!
        f32[o + 4] = data.chainColorTypes[i]!
      }
      r.cloudBuffer = this.mkBuf(device, buf)
      r.cloudBG = this.mkBG(device, r.cloudBuffer)
      r.cloudCount = n
    }
  }

  uploadConnectingLinesForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadConnectingLinesFromTypedArrays']>[0],
  ) {
    if (this.glFallback) {
      this.glFallback.uploadConnectingLinesForRegion(regionNumber, data)
      return
    }
    const device = AlignmentsRenderer.device
    if (!device) {
      return
    }
    let r = this.regions.get(regionNumber)
    if (!r) {
      r = this.getOrCreateRegion(regionNumber, data.regionStart)
    }
    r.connLineBuffer?.destroy()
    r.connLineBG = null
    r.connLineCount = 0
    if (data.numConnectingLines > 0) {
      const n = data.numConnectingLines
      const buf = new ArrayBuffer(n * CONN_LINE_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * CONN_LINE_STRIDE
        u32[o] = data.connectingLinePositions[i * 2]!
        u32[o + 1] = data.connectingLinePositions[i * 2 + 1]!
        f32[o + 2] = data.connectingLineYs[i]!
      }
      r.connLineBuffer = this.mkBuf(device, buf)
      r.connLineBG = this.mkBG(device, r.connLineBuffer)
      r.connLineCount = n
    }
  }

  private writeColor(slot: number, c: [number, number, number]) {
    this.uF32[slot] = c[0]
    this.uF32[slot + 1] = c[1]
    this.uF32[slot + 2] = c[2]
  }

  private writeUniforms(
    device: GPUDevice,
    state: RenderState,
    bpHi: number,
    bpLo: number,
    bpLen: number,
    regionStart: number,
    canvasW: number,
    region: GpuRegion,
    clippedBpStart: number,
    clippedBpEnd: number,
  ) {
    const f = this.uF32
    const u = this.uU32
    const ii = this.uI32
    f[U_BP_HI] = bpHi
    f[U_BP_LO] = bpLo
    f[U_BP_LEN] = bpLen
    u[U_REGION_START] = regionStart
    f[U_HP_ZERO] = 0.0
    f[U_DOMAIN_START] = clippedBpStart - regionStart
    f[U_DOMAIN_END] = clippedBpEnd - regionStart
    f[U_RANGE_Y0] = state.rangeY[0]
    f[U_CANVAS_H] = state.canvasHeight
    f[U_CANVAS_W] = canvasW
    const arcsOffset = state.showArcs && state.arcsHeight ? state.arcsHeight : 0
    f[U_COV_OFFSET] =
      (state.showCoverage ? state.coverageHeight : 0) + arcsOffset
    f[U_FEAT_H] = state.featureHeight
    f[U_FEAT_SPACING] = state.featureSpacing
    ii[U_COLOR_SCHEME] = state.colorScheme
    ii[U_HIGHLIGHT_IDX] = state.highlightedFeatureIndex
    ii[U_HIGHLIGHT_ONLY] = 0
    ii[U_CHAIN_MODE] =
      state.renderingMode === 'cloud' || state.renderingMode === 'linkedRead'
        ? 1
        : 0
    ii[U_SHOW_STROKE] = state.featureHeight >= 4 ? 1 : 0
    f[U_COV_HEIGHT] = state.coverageHeight
    f[U_COV_Y_OFFSET] = state.coverageYOffset
    f[U_DEPTH_SCALE] =
      state.coverageNicedMax !== undefined && region.maxDepth > 0
        ? region.maxDepth / state.coverageNicedMax
        : 1
    f[U_BIN_SIZE] = region.binSize
    f[U_NONCOV_HEIGHT] =
      region.noncovMaxCount > 0 ? Math.min(region.noncovMaxCount * 2, 20) : 0
    f[U_INSERT_UPPER] = region.insertSizeStats?.upper ?? 999999
    f[U_INSERT_LOWER] = region.insertSizeStats?.lower ?? 0
    ii[U_ERASE_MODE] = 0
    f[U_SCROLL_TOP] = state.rangeY[0]
    ii[U_CLOUD_COLOR_SCHEME] = state.cloudColorScheme ?? 0

    const c = state.colors
    this.writeColor(U_COLOR_FWD, c.colorFwdStrand)
    this.writeColor(U_COLOR_REV, c.colorRevStrand)
    this.writeColor(U_COLOR_NOSTRAND, c.colorNostrand)
    this.writeColor(U_COLOR_PAIR_LR, c.colorPairLR)
    this.writeColor(U_COLOR_PAIR_RL, c.colorPairRL)
    this.writeColor(U_COLOR_PAIR_RR, c.colorPairRR)
    this.writeColor(U_COLOR_PAIR_LL, c.colorPairLL)
    this.writeColor(U_COLOR_BASE_A, c.colorBaseA)
    this.writeColor(U_COLOR_BASE_C, c.colorBaseC)
    this.writeColor(U_COLOR_BASE_G, c.colorBaseG)
    this.writeColor(U_COLOR_BASE_T, c.colorBaseT)
    this.writeColor(U_COLOR_INSERTION, c.colorInsertion)
    this.writeColor(U_COLOR_DELETION, c.colorDeletion)
    this.writeColor(U_COLOR_SKIP, c.colorSkip)
    this.writeColor(U_COLOR_SOFTCLIP, c.colorSoftclip)
    this.writeColor(U_COLOR_HARDCLIP, c.colorHardclip)
    this.writeColor(U_COLOR_COVERAGE, c.colorCoverage)
    this.writeColor(U_COLOR_MOD_FWD, c.colorModificationFwd)
    this.writeColor(U_COLOR_MOD_REV, c.colorModificationRev)
    this.writeColor(U_COLOR_LONG_INSERT, c.colorLongInsert)
    this.writeColor(U_COLOR_SHORT_INSERT, c.colorShortInsert)
    this.writeColor(U_COLOR_SUPPLEMENTARY, c.colorSupplementary)

    for (const [i, element] of arcColorPalette.entries()) {
      this.writeColor(U_ARC_COLORS + i * 3, element)
    }
    for (const [i, element] of arcLineColorPalette.entries()) {
      this.writeColor(U_ARC_LINE_COLORS + i * 3, element)
    }
    for (const [i, element] of sashimiColorPalette.entries()) {
      this.writeColor(U_SASHIMI_COLORS + i * 3, element)
    }

    device.queue.writeBuffer(this.uBuf!, 0, this.uData)
  }

  renderBlocks(
    blocks: {
      regionNumber: number
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    }[],
    state: RenderState,
  ) {
    if (this.glFallback) {
      this.glFallback.renderBlocks(blocks, state)
      return
    }
    const device = AlignmentsRenderer.device
    if (!device || !this.ctx) {
      return
    }
    const { canvasWidth, canvasHeight } = state
    const dpr = window.devicePixelRatio || 1
    const bufW = Math.round(canvasWidth * dpr)
    const bufH = Math.round(canvasHeight * dpr)

    if (this.canvas.width !== bufW || this.canvas.height !== bufH) {
      this.canvas.width = bufW
      this.canvas.height = bufH
    }

    const textureView = this.ctx.getCurrentTexture().createView()
    let isFirst = true
    const tempBuffers: GPUBuffer[] = []

    const mkPass = (loadOp: GPULoadOp) => {
      const enc = device.createCommandEncoder()
      const p = enc.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            loadOp,
            storeOp: 'store' as GPUStoreOp,
            ...(loadOp === 'clear' && {
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
            }),
          },
        ],
      })
      return { enc, p }
    }

    const submitPass = (enc: GPUCommandEncoder, p: GPURenderPassEncoder) => {
      p.end()
      device.queue.submit([enc.finish()])
    }

    for (const block of blocks) {
      const region = this.regions.get(block.regionNumber)
      if (!region) {
        continue
      }

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const bpPerPx =
        fullBlockWidth > 0
          ? (block.bpRangeX[1] - block.bpRangeX[0]) / fullBlockWidth
          : 1
      const clippedBpStart =
        block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedBpEnd =
        block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx
      const [bpHi, bpLo] = splitPositionWithFrac(clippedBpStart)
      const bpLen = clippedBpEnd - clippedBpStart

      this.writeUniforms(
        device,
        state,
        bpHi,
        bpLo,
        bpLen,
        region.regionStart,
        scissorW,
        region,
        clippedBpStart,
        clippedBpEnd,
      )

      const mode = state.renderingMode ?? 'pileup'
      const arcsHeight =
        mode === 'pileup' && state.showArcs && state.arcsHeight
          ? state.arcsHeight
          : 0
      const covH = state.showCoverage ? state.coverageHeight : 0

      {
        const { enc, p } = mkPass(
          isFirst ? ('clear' as GPULoadOp) : ('load' as GPULoadOp),
        )
        p.setViewport(
          Math.round(scissorX * dpr),
          0,
          Math.round(scissorW * dpr),
          bufH,
          0,
          1,
        )
        p.setScissorRect(
          Math.round(scissorX * dpr),
          0,
          Math.round(scissorW * dpr),
          bufH,
        )

        if (state.showCoverage) {
          this.drawCoverage(p, region)
        }

        if (mode === 'arcs') {
          this.drawArcs(p, region, state, block, scissorX, scissorW)
        } else if (mode === 'cloud' || mode === 'linkedRead') {
          this.drawConnectingLines(p, region)
          this.drawPileup(p, region, state)
          this.drawChainOverlays(
            p,
            region,
            state,
            bpHi,
            bpLo,
            bpLen,
            scissorW,
            tempBuffers,
          )
        } else {
          this.drawPileup(p, region, state)
        }

        submitPass(enc, p)
      }

      if (arcsHeight > 0) {
        this.uF32[U_COV_OFFSET] = 0
        this.uF32[U_CANVAS_H] = arcsHeight
        device.queue.writeBuffer(this.uBuf!, 0, this.uData)

        const { enc, p } = mkPass('load' as GPULoadOp)
        p.setViewport(
          Math.round(scissorX * dpr),
          Math.round(covH * dpr),
          Math.round(scissorW * dpr),
          Math.round(arcsHeight * dpr),
          0,
          1,
        )
        p.setScissorRect(
          Math.round(scissorX * dpr),
          Math.round(covH * dpr),
          Math.round(scissorW * dpr),
          Math.round(arcsHeight * dpr),
        )
        this.drawArcs(p, region, state, block, scissorX, scissorW)
        submitPass(enc, p)

        this.uF32[U_COV_OFFSET] = covH + arcsHeight
        this.uF32[U_CANVAS_H] = state.canvasHeight
        device.queue.writeBuffer(this.uBuf!, 0, this.uData)
      }

      if (state.showSashimiArcs && state.showCoverage) {
        const { enc, p } = mkPass('load' as GPULoadOp)
        p.setViewport(
          Math.round(scissorX * dpr),
          0,
          Math.round(scissorW * dpr),
          bufH,
          0,
          1,
        )
        p.setScissorRect(
          Math.round(scissorX * dpr),
          0,
          Math.round(scissorW * dpr),
          bufH,
        )
        this.drawSashimi(p, region, state, block, scissorX, scissorW)
        submitPass(enc, p)
      }

      isFirst = false
    }

    for (const buf of tempBuffers) {
      buf.destroy()
    }

    if (isFirst) {
      const { enc, p } = mkPass('clear' as GPULoadOp)
      submitPass(enc, p)
    }
  }

  private drawCoverage(pass: GPURenderPassEncoder, r: GpuRegion) {
    if (r.coverageBG && r.coverageCount > 0) {
      pass.setPipeline(AlignmentsRenderer.coveragePL!)
      pass.setBindGroup(0, r.coverageBG)
      pass.draw(6, r.coverageCount)
    }
    if (r.snpCovBG && r.snpCovCount > 0) {
      pass.setPipeline(AlignmentsRenderer.snpCovPL!)
      pass.setBindGroup(0, r.snpCovBG)
      pass.draw(6, r.snpCovCount)
    }
    if (r.modCovBG && r.modCovCount > 0) {
      pass.setPipeline(AlignmentsRenderer.modCovPL!)
      pass.setBindGroup(0, r.modCovBG)
      pass.draw(6, r.modCovCount)
    }
    if (r.noncovBG && r.noncovCount > 0) {
      pass.setPipeline(AlignmentsRenderer.noncovPL!)
      pass.setBindGroup(0, r.noncovBG)
      pass.draw(6, r.noncovCount)
    }
    if (r.indicatorBG && r.indicatorCount > 0) {
      pass.setPipeline(AlignmentsRenderer.indicatorPL!)
      pass.setBindGroup(0, r.indicatorBG)
      pass.draw(3, r.indicatorCount)
    }
  }

  private drawPileup(
    pass: GPURenderPassEncoder,
    r: GpuRegion,
    state: RenderState,
  ) {
    if (state.showMismatches) {
      if (r.gapBG && r.gapCount > 0) {
        pass.setPipeline(AlignmentsRenderer.gapPL!)
        pass.setBindGroup(0, r.gapBG)
        pass.draw(6, r.gapCount)
      }
    }

    if (r.readBG && r.readCount > 0) {
      pass.setPipeline(AlignmentsRenderer.readPL!)
      pass.setBindGroup(0, r.readBG)
      pass.draw(9, r.readCount)
    }

    if (state.showMismatches) {
      if (r.mismatchBG && r.mismatchCount > 0) {
        pass.setPipeline(AlignmentsRenderer.mismatchPL!)
        pass.setBindGroup(0, r.mismatchBG)
        pass.draw(6, r.mismatchCount)
      }
      if (r.insertionBG && r.insertionCount > 0) {
        pass.setPipeline(AlignmentsRenderer.insertionPL!)
        pass.setBindGroup(0, r.insertionBG)
        pass.draw(18, r.insertionCount)
      }
      if (r.softclipBG && r.softclipCount > 0) {
        pass.setPipeline(AlignmentsRenderer.softclipPL!)
        pass.setBindGroup(0, r.softclipBG)
        pass.draw(6, r.softclipCount)
      }
      if (r.hardclipBG && r.hardclipCount > 0) {
        pass.setPipeline(AlignmentsRenderer.hardclipPL!)
        pass.setBindGroup(0, r.hardclipBG)
        pass.draw(6, r.hardclipCount)
      }
    }

    if (state.showModifications && r.modBG && r.modCount > 0) {
      pass.setPipeline(AlignmentsRenderer.modPL!)
      pass.setBindGroup(0, r.modBG)
      pass.draw(6, r.modCount)
    }
  }

  private writeBlockUniforms(
    r: GpuRegion,
    block: {
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    },
    vpX: number,
    vpW: number,
  ) {
    const blockW = block.screenEndPx - block.screenStartPx
    const [hi, lo] = splitPositionWithFrac(block.bpRangeX[0])
    this.uF32[U_CANVAS_W] = vpW
    this.uF32[U_BLOCK_START_PX] = block.screenStartPx - vpX
    this.uF32[U_BLOCK_WIDTH] = blockW
    this.uF32[U_BP_HI] = hi
    this.uF32[U_BP_LO] = lo
    this.uF32[U_BP_LEN] = block.bpRangeX[1] - block.bpRangeX[0]
    this.uF32[U_DOMAIN_START] = block.bpRangeX[0] - r.regionStart
    this.uF32[U_DOMAIN_END] = block.bpRangeX[1] - r.regionStart
    this.uU32[U_REGION_START] = r.regionStart
  }

  private drawArcs(
    pass: GPURenderPassEncoder,
    r: GpuRegion,
    state: RenderState,
    block: {
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    },
    vpX: number,
    vpW: number,
  ) {
    const device = AlignmentsRenderer.device!
    this.writeBlockUniforms(r, block, vpX, vpW)
    this.uF32[U_LINE_WIDTH_PX] = state.arcLineWidth ?? 1
    this.uF32[U_GRADIENT_HUE] = 0
    device.queue.writeBuffer(this.uBuf!, 0, this.uData)

    if (r.arcBG && r.arcCount > 0) {
      pass.setPipeline(AlignmentsRenderer.arcPL!)
      pass.setBindGroup(0, r.arcBG)
      pass.draw((ARC_CURVE_SEGMENTS + 1) * 2, r.arcCount)
    }
    if (r.arcLineBG && r.arcLineCount > 0) {
      pass.setPipeline(AlignmentsRenderer.arcLinePL!)
      pass.setBindGroup(0, r.arcLineBG)
      pass.draw(2, r.arcLineCount)
    }
  }

  private drawSashimi(
    pass: GPURenderPassEncoder,
    r: GpuRegion,
    state: RenderState,
    block: {
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    },
    vpX: number,
    vpW: number,
  ) {
    if (!r.sashimiBG || r.sashimiCount === 0) {
      return
    }
    const device = AlignmentsRenderer.device!
    this.writeBlockUniforms(r, block, vpX, vpW)
    this.uF32[U_COV_OFFSET] = state.showCoverage ? state.coverageYOffset : 0
    device.queue.writeBuffer(this.uBuf!, 0, this.uData)

    pass.setPipeline(AlignmentsRenderer.sashimiPL!)
    pass.setBindGroup(0, r.sashimiBG)
    pass.draw((ARC_CURVE_SEGMENTS + 1) * 2, r.sashimiCount)
    this.uF32[U_COV_OFFSET] = state.showCoverage ? state.coverageHeight : 0
  }

  private drawConnectingLines(pass: GPURenderPassEncoder, r: GpuRegion) {
    if (r.connLineBG && r.connLineCount > 0) {
      pass.setPipeline(AlignmentsRenderer.connLinePL!)
      pass.setBindGroup(0, r.connLineBG)
      pass.draw(6, r.connLineCount)
    }
  }

  private drawChainOverlays(
    pass: GPURenderPassEncoder,
    region: GpuRegion,
    state: RenderState,
    bpHi: number,
    bpLo: number,
    bpLen: number,
    viewportW: number,
    tempBuffers: GPUBuffer[],
  ) {
    const quads: number[] = []
    const covOff = state.showCoverage ? state.coverageHeight : 0

    if (state.highlightedChainIndices.length > 0) {
      const bounds = getChainBounds(
        state.highlightedChainIndices,
        region.readPositions,
        region.readYs,
      )
      if (bounds) {
        const clip = toClipRect(
          bounds.minStart + region.regionStart,
          bounds.maxEnd + region.regionStart,
          bounds.y,
          state,
          bpHi,
          bpLo,
          bpLen,
          covOff,
          state.canvasHeight,
        )
        quads.push(clip.sx1, clip.syTop, clip.sx2, clip.syBot, 0, 0, 0, 0.4)
      }
    }

    if (state.selectedChainIndices.length > 0) {
      const bounds = getChainBounds(
        state.selectedChainIndices,
        region.readPositions,
        region.readYs,
      )
      if (bounds) {
        const clip = toClipRect(
          bounds.minStart + region.regionStart,
          bounds.maxEnd + region.regionStart,
          bounds.y,
          state,
          bpHi,
          bpLo,
          bpLen,
          covOff,
          state.canvasHeight,
        )
        const tx = 4 / viewportW
        const ty = 4 / state.canvasHeight
        quads.push(
          clip.sx1,
          clip.syTop,
          clip.sx2,
          clip.syTop - ty,
          0,
          0,
          0,
          1,
          clip.sx1,
          clip.syBot + ty,
          clip.sx2,
          clip.syBot,
          0,
          0,
          0,
          1,
          clip.sx1,
          clip.syTop,
          clip.sx1 + tx,
          clip.syBot,
          0,
          0,
          0,
          1,
          clip.sx2 - tx,
          clip.syTop,
          clip.sx2,
          clip.syBot,
          0,
          0,
          0,
          1,
        )
      }
    }

    if (quads.length > 0) {
      this.drawOverlayQuads(
        pass,
        new Float32Array(quads),
        quads.length / 8,
        tempBuffers,
      )
    }
  }

  private drawOverlayQuads(
    pass: GPURenderPassEncoder,
    quads: Float32Array,
    count: number,
    tempBuffers: GPUBuffer[],
  ) {
    const device = AlignmentsRenderer.device!
    const buf = this.mkBuf(device, quads.buffer as ArrayBuffer)
    tempBuffers.push(buf)
    const bg = this.mkBG(device, buf)
    pass.setPipeline(AlignmentsRenderer.flatQuadPL!)
    pass.setBindGroup(0, bg)
    pass.draw(6, count)
  }

  destroy() {
    if (this.glFallback) {
      this.glFallback.destroy()
      this.glFallback = null
      return
    }
    for (const r of this.regions.values()) {
      this.destroyRegion(r)
    }
    this.regions.clear()
    this.uBuf?.destroy()
    this.uBuf = null
    this.ctx = null
    cache.delete(this.canvas)
  }
}
