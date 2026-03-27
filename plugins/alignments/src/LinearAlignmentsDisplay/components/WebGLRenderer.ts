/**
 * WebGL Renderer for alignments display
 *
 * Handles pileup and arcs rendering modes with shared coverage.
 * Manages shader compilation, buffer management, and rendering.
 * Data is uploaded once, then rendering only updates uniforms.
 *
 * High-precision position handling inspired by genome-spy
 * (https://github.com/genome-spy/genome-spy)
 *
 * The challenge: Float32 loses precision for large genomic positions (e.g., 200,000,000 bp).
 * The solution: 12-bit split approach where positions are split into:
 *   - High part: multiples of 4096 (captures large magnitude)
 *   - Low part: 0-4095 + fractional (captures fine detail)
 *
 * In the shader, high parts are subtracted separately from low parts, then combined.
 * This preserves precision because each subtraction involves similar-magnitude values.
 *
 * For smooth scrolling, the domain start must preserve fractional precision - otherwise
 * reads appear to "stick" at integer positions and snap when crossing boundaries.
 */

import {
  cacheUniforms,
  createProgram,
  enableStandardBlend,
} from '@jbrowse/core/gpu/webglUtils'

import { renderArcLines, renderArcs } from './ArcsRenderer.ts'
import { renderConnectingLine } from './ConnectingLineRenderer.ts'
import { renderCoverage } from './CoverageRenderer.ts'
import { renderPileup } from './PileupRenderer.ts'
import {
  ARC_CURVE_SEGMENTS,
  ARC_FRAGMENT_SHADER,
  ARC_LINE_FRAGMENT_SHADER,
  ARC_LINE_VERTEX_SHADER,
  ARC_VERTEX_SHADER,
  CONNECTING_LINE_FRAGMENT_SHADER,
  CONNECTING_LINE_VERTEX_SHADER,
  COVERAGE_FRAGMENT_SHADER,
  COVERAGE_VERTEX_SHADER,
  GAP_FRAGMENT_SHADER,
  GAP_VERTEX_SHADER,
  HARDCLIP_FRAGMENT_SHADER,
  HARDCLIP_VERTEX_SHADER,
  INDICATOR_FRAGMENT_SHADER,
  INDICATOR_VERTEX_SHADER,
  INSERTION_FRAGMENT_SHADER,
  INSERTION_VERTEX_SHADER,
  LINE_FRAGMENT_SHADER,
  LINE_VERTEX_SHADER,
  MAX_REGIONS,
  MISMATCH_FRAGMENT_SHADER,
  MISMATCH_VERTEX_SHADER,
  MODIFICATION_FRAGMENT_SHADER,
  MODIFICATION_VERTEX_SHADER,
  MOD_COVERAGE_FRAGMENT_SHADER,
  MOD_COVERAGE_VERTEX_SHADER,
  NONCOV_HISTOGRAM_FRAGMENT_SHADER,
  NONCOV_HISTOGRAM_VERTEX_SHADER,
  NUM_ARC_COLORS,
  NUM_LINE_COLORS,
  NUM_SASHIMI_COLORS,
  READ_FRAGMENT_SHADER,
  READ_VERTEX_SHADER,
  SASHIMI_ARC_FRAGMENT_SHADER,
  SASHIMI_ARC_VERTEX_SHADER,
  SNP_COVERAGE_FRAGMENT_SHADER,
  SNP_COVERAGE_VERTEX_SHADER,
  SOFTCLIP_FRAGMENT_SHADER,
  SOFTCLIP_VERTEX_SHADER,
} from './shaders/index.ts'
import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../../shared/types.ts'

import type {
  AlignmentsBackend,
  ArcsUploadData,
  CigarUploadData,
  ConnectingLinesUploadData,
  CoverageUploadData,
  ModCoverageUploadData,
  ModificationUploadData,
  ReadUploadData,
  RenderBlock,
  RenderState,
  SashimiUploadData,
} from './rendererTypes.ts'

export interface GPUBuffers {
  // Reference point for all position offsets
  regionStart: number
  readIdToIndex: Map<string, number>
  readVAO: WebGLVertexArrayObject
  segmentCount: number
  // CPU-side copies for selection outline drawing
  readPositions: Uint32Array
  readYs: Uint16Array
  readStrands: Int8Array
  coverageVAO: WebGLVertexArrayObject | null
  coverageCount: number
  maxDepth: number
  binSize: number
  // SNP coverage (exact positions)
  snpCoverageVAO: WebGLVertexArrayObject | null
  snpCoverageCount: number
  // Noncov histogram (insertion/softclip/hardclip counts)
  noncovHistogramVAO: WebGLVertexArrayObject | null
  noncovHistogramCount: number
  noncovMaxCount: number
  // Interbase indicators (triangles)
  indicatorVAO: WebGLVertexArrayObject | null
  indicatorCount: number
  // CIGAR data
  gapVAO: WebGLVertexArrayObject | null
  gapCount: number
  mismatchVAO: WebGLVertexArrayObject | null
  mismatchCount: number
  insertionVAO: WebGLVertexArrayObject | null
  insertionCount: number
  softclipVAO: WebGLVertexArrayObject | null
  softclipCount: number
  softclipBaseVAO: WebGLVertexArrayObject | null
  softclipBaseCount: number
  hardclipVAO: WebGLVertexArrayObject | null
  hardclipCount: number
  modificationVAO: WebGLVertexArrayObject | null
  modificationCount: number
  modCoverageVAO: WebGLVertexArrayObject | null
  modCoverageCount: number
  // Arcs mode
  arcVAO: WebGLVertexArrayObject | null
  arcCount: number
  arcLineVAO: WebGLVertexArrayObject | null
  arcLineCount: number
  connectingLineVAO: WebGLVertexArrayObject | null
  connectingLineCount: number
  // Sashimi arcs (splice junctions)
  sashimiVAO: WebGLVertexArrayObject | null
  sashimiCount: number
  // Insert size statistics for threshold-based coloring
  insertSizeStats?: {
    upper: number
    lower: number
  }
}

export class WebGLRenderer implements AlignmentsBackend {
  gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  dpr = window.devicePixelRatio || 1

  readProgram: WebGLProgram
  coverageProgram: WebGLProgram
  snpCoverageProgram: WebGLProgram
  noncovHistogramProgram: WebGLProgram
  indicatorProgram: WebGLProgram
  lineProgram: WebGLProgram
  gapProgram: WebGLProgram
  mismatchProgram: WebGLProgram
  insertionProgram: WebGLProgram
  softclipProgram: WebGLProgram
  hardclipProgram: WebGLProgram
  modificationProgram: WebGLProgram
  modCoverageProgram: WebGLProgram

  buffers: GPUBuffers | null = null
  private glBuffers: WebGLBuffer[] = []
  private buffersMap = new Map<number, GPUBuffers>()
  private glBuffersMap = new Map<number, WebGLBuffer[]>()
  private arcInstanceBuffersMap = new Map<number, WebGLBuffer[]>()
  lineVAO: WebGLVertexArrayObject | null = null
  lineBuffer: WebGLBuffer | null = null

  readUniforms: Record<string, WebGLUniformLocation | null> = {}
  coverageUniforms: Record<string, WebGLUniformLocation | null> = {}
  snpCoverageUniforms: Record<string, WebGLUniformLocation | null> = {}
  noncovHistogramUniforms: Record<string, WebGLUniformLocation | null> = {}
  indicatorUniforms: Record<string, WebGLUniformLocation | null> = {}
  lineUniforms: Record<string, WebGLUniformLocation | null> = {}
  gapUniforms: Record<string, WebGLUniformLocation | null> = {}
  mismatchUniforms: Record<string, WebGLUniformLocation | null> = {}
  insertionUniforms: Record<string, WebGLUniformLocation | null> = {}
  softclipUniforms: Record<string, WebGLUniformLocation | null> = {}
  hardclipUniforms: Record<string, WebGLUniformLocation | null> = {}
  modificationUniforms: Record<string, WebGLUniformLocation | null> = {}
  modCoverageUniforms: Record<string, WebGLUniformLocation | null> = {}

  // Arcs mode
  arcProgram: WebGLProgram | null = null
  arcLineProgram: WebGLProgram | null = null
  private arcTemplateBuffer: WebGLBuffer | null = null
  private arcInstanceBuffers: WebGLBuffer[] = []
  arcUniforms: Record<string, WebGLUniformLocation | null> = {}
  arcLineUniforms: Record<string, WebGLUniformLocation | null> = {}

  // Sashimi mode
  sashimiProgram: WebGLProgram | null = null
  private sashimiInstanceBuffers: WebGLBuffer[] = []
  private sashimiInstanceBuffersMap = new Map<number, WebGLBuffer[]>()
  sashimiUniforms: Record<string, WebGLUniformLocation | null> = {}

  connectingLineProgram: WebGLProgram | null = null
  private connectingLineGLBuffers: WebGLBuffer[] = []
  private connectingLineGLBuffersMap = new Map<number, WebGLBuffer[]>()
  connectingLineUniforms: Record<string, WebGLUniformLocation | null> = {}

  // Sub-renderers

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    })

    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.readProgram = createProgram(
      gl,
      READ_VERTEX_SHADER,
      READ_FRAGMENT_SHADER,
    )

    this.coverageProgram = createProgram(
      gl,
      COVERAGE_VERTEX_SHADER,
      COVERAGE_FRAGMENT_SHADER,
    )

    this.snpCoverageProgram = createProgram(
      gl,
      SNP_COVERAGE_VERTEX_SHADER,
      SNP_COVERAGE_FRAGMENT_SHADER,
    )

    this.noncovHistogramProgram = createProgram(
      gl,
      NONCOV_HISTOGRAM_VERTEX_SHADER,
      NONCOV_HISTOGRAM_FRAGMENT_SHADER,
    )

    this.indicatorProgram = createProgram(
      gl,
      INDICATOR_VERTEX_SHADER,
      INDICATOR_FRAGMENT_SHADER,
    )

    this.lineProgram = createProgram(
      gl,
      LINE_VERTEX_SHADER,
      LINE_FRAGMENT_SHADER,
    )
    this.gapProgram = createProgram(gl, GAP_VERTEX_SHADER, GAP_FRAGMENT_SHADER)
    this.mismatchProgram = createProgram(
      gl,
      MISMATCH_VERTEX_SHADER,
      MISMATCH_FRAGMENT_SHADER,
    )
    this.insertionProgram = createProgram(
      gl,
      INSERTION_VERTEX_SHADER,
      INSERTION_FRAGMENT_SHADER,
    )
    this.softclipProgram = createProgram(
      gl,
      SOFTCLIP_VERTEX_SHADER,
      SOFTCLIP_FRAGMENT_SHADER,
    )
    this.hardclipProgram = createProgram(
      gl,
      HARDCLIP_VERTEX_SHADER,
      HARDCLIP_FRAGMENT_SHADER,
    )
    this.modificationProgram = createProgram(
      gl,
      MODIFICATION_VERTEX_SHADER,
      MODIFICATION_FRAGMENT_SHADER,
    )
    this.modCoverageProgram = createProgram(
      gl,
      MOD_COVERAGE_VERTEX_SHADER,
      MOD_COVERAGE_FRAGMENT_SHADER,
    )

    this.lineUniforms = cacheUniforms(gl, this.lineProgram, ['u_color'])

    // Create line VAO and buffer for separator
    this.lineVAO = gl.createVertexArray()
    this.lineBuffer = gl.createBuffer()
    gl.bindVertexArray(this.lineVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
    const linePosLoc = gl.getAttribLocation(this.lineProgram, 'a_position')
    gl.enableVertexAttribArray(linePosLoc)
    gl.vertexAttribPointer(linePosLoc, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    this.readUniforms = cacheUniforms(gl, this.readProgram, [
      'u_bpRangeX',
      'u_regionStart',
      'u_rangeY',
      'u_colorScheme',
      'u_featureHeight',
      'u_featureSpacing',
      'u_coverageOffset',
      'u_canvasHeight',
      'u_highlightedIndex',
      'u_highlightOnlyMode',
      'u_canvasWidth',
      // Color uniforms
      'u_colorFwdStrand',
      'u_colorRevStrand',
      'u_colorNostrand',
      'u_colorPairLR',
      'u_colorPairRL',
      'u_colorPairRR',
      'u_colorPairLL',
      'u_colorModificationFwd',
      'u_colorModificationRev',
      'u_colorLongInsert',
      'u_colorShortInsert',
      'u_colorSupplementary',
      'u_colorUnmappedMate',
      'u_insertSizeUpper',
      'u_insertSizeLower',
      'u_chainMode',
      'u_flipStrandLongReadChains',
      'u_showStroke',
      'u_zero',
    ])

    this.coverageUniforms = cacheUniforms(gl, this.coverageProgram, [
      'u_visibleRange',
      'u_coverageHeight',
      'u_coverageYOffset',
      'u_depthScale',
      'u_binSize',
      'u_canvasHeight',
      'u_canvasWidth',
      'u_colorCoverage',
    ])

    // Base color uniforms for SNP/mismatch shaders
    const baseColorUniforms = [
      'u_colorBaseA',
      'u_colorBaseC',
      'u_colorBaseG',
      'u_colorBaseT',
    ]
    // Indel/clip color uniforms
    const indelColorUniforms = [
      'u_colorInsertion',
      'u_colorSoftclip',
      'u_colorHardclip',
    ]

    this.snpCoverageUniforms = cacheUniforms(gl, this.snpCoverageProgram, [
      'u_visibleRange',
      'u_coverageHeight',
      'u_coverageYOffset',
      'u_depthScale',
      'u_canvasHeight',
      'u_canvasWidth',
      ...baseColorUniforms,
    ])

    this.noncovHistogramUniforms = cacheUniforms(
      gl,
      this.noncovHistogramProgram,
      [
        'u_visibleRange',
        'u_noncovHeight',
        'u_canvasHeight',
        'u_canvasWidth',
        ...indelColorUniforms,
      ],
    )

    this.indicatorUniforms = cacheUniforms(gl, this.indicatorProgram, [
      'u_visibleRange',
      'u_canvasHeight',
      'u_canvasWidth',
      ...indelColorUniforms,
    ])

    const cigarUniforms = [
      'u_bpRangeX',
      'u_rangeY',
      'u_featureHeight',
      'u_featureSpacing',
      'u_coverageOffset',
      'u_canvasHeight',
      'u_canvasWidth',
    ]
    this.gapUniforms = cacheUniforms(gl, this.gapProgram, [
      ...cigarUniforms,
      'u_colorDeletion',
      'u_colorSkip',
    ])
    this.mismatchUniforms = cacheUniforms(gl, this.mismatchProgram, [
      ...cigarUniforms,
      ...baseColorUniforms,
    ])
    this.insertionUniforms = cacheUniforms(gl, this.insertionProgram, [
      ...cigarUniforms,
      'u_colorInsertion',
    ])
    this.softclipUniforms = cacheUniforms(gl, this.softclipProgram, [
      ...cigarUniforms,
      'u_colorSoftclip',
    ])
    this.hardclipUniforms = cacheUniforms(gl, this.hardclipProgram, [
      ...cigarUniforms,
      'u_colorHardclip',
    ])
    this.modificationUniforms = cacheUniforms(gl, this.modificationProgram, [
      ...cigarUniforms,
    ])
    this.modCoverageUniforms = cacheUniforms(gl, this.modCoverageProgram, [
      'u_visibleRange',
      'u_coverageHeight',
      'u_coverageYOffset',
      'u_depthScale',
      'u_canvasHeight',
      'u_canvasWidth',
    ])

    // Arcs programs
    this.arcProgram = createProgram(gl, ARC_VERTEX_SHADER, ARC_FRAGMENT_SHADER)
    this.arcLineProgram = createProgram(
      gl,
      ARC_LINE_VERTEX_SHADER,
      ARC_LINE_FRAGMENT_SHADER,
    )

    this.arcUniforms = cacheUniforms(gl, this.arcProgram, [
      'u_canvasWidth',
      'u_canvasHeight',
      'u_coverageOffset',
      'u_lineWidthPx',
      'u_gradientHue',
      'u_numRegions',
    ])
    for (let i = 0; i < NUM_ARC_COLORS; i++) {
      this.arcUniforms[`u_arcColors[${i}]`] = gl.getUniformLocation(
        this.arcProgram,
        `u_arcColors[${i}]`,
      )
    }
    for (let i = 0; i < MAX_REGIONS; i++) {
      this.arcUniforms[`u_regions[${i}]`] = gl.getUniformLocation(
        this.arcProgram,
        `u_regions[${i}]`,
      )
    }

    this.arcLineUniforms = cacheUniforms(gl, this.arcLineProgram, [
      'u_bpRangeX',
      'u_regionStart',
      'u_canvasHeight',
      'u_coverageOffset',
      'u_blockStartPx',
      'u_blockWidth',
      'u_canvasWidth',
      'u_zero',
    ])
    for (let i = 0; i < NUM_LINE_COLORS; i++) {
      this.arcLineUniforms[`u_arcLineColors[${i}]`] = gl.getUniformLocation(
        this.arcLineProgram,
        `u_arcLineColors[${i}]`,
      )
    }

    // Arc template buffer (shared triangle strip for instanced curves)
    const numArcVertices = (ARC_CURVE_SEGMENTS + 1) * 2
    const templateData = new Float32Array(numArcVertices * 2)
    for (let i = 0; i <= ARC_CURVE_SEGMENTS; i++) {
      const t = i / ARC_CURVE_SEGMENTS
      const base = i * 4
      templateData[base + 0] = t
      templateData[base + 1] = 1
      templateData[base + 2] = t
      templateData[base + 3] = -1
    }
    this.arcTemplateBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arcTemplateBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, templateData, gl.STATIC_DRAW)

    // Sashimi program (reuses arc template buffer)
    this.sashimiProgram = createProgram(
      gl,
      SASHIMI_ARC_VERTEX_SHADER,
      SASHIMI_ARC_FRAGMENT_SHADER,
    )
    this.sashimiUniforms = cacheUniforms(gl, this.sashimiProgram, [
      'u_canvasWidth',
      'u_canvasHeight',
      'u_coverageOffset',
      'u_coverageHeight',
      'u_numRegions',
    ])
    for (let i = 0; i < NUM_SASHIMI_COLORS; i++) {
      this.sashimiUniforms[`u_sashimiColors[${i}]`] = gl.getUniformLocation(
        this.sashimiProgram,
        `u_sashimiColors[${i}]`,
      )
    }
    for (let i = 0; i < MAX_REGIONS; i++) {
      this.sashimiUniforms[`u_regions[${i}]`] = gl.getUniformLocation(
        this.sashimiProgram,
        `u_regions[${i}]`,
      )
    }

    // Connecting line program
    this.connectingLineProgram = createProgram(
      gl,
      CONNECTING_LINE_VERTEX_SHADER,
      CONNECTING_LINE_FRAGMENT_SHADER,
    )
    this.connectingLineUniforms = cacheUniforms(
      gl,
      this.connectingLineProgram,
      [
        'u_bpRangeX',
        'u_regionStart',
        'u_featureHeight',
        'u_featureSpacing',
        'u_canvasHeight',
        'u_scrollTop',
        'u_coverageOffset',
        'u_zero',
      ],
    )

    enableStandardBlend(gl)
  }

  /**
   * Upload reads from pre-computed typed arrays (from RPC worker)
   * Positions are offsets from regionStart for Float32 precision
   */
  uploadFromTypedArrays(data: {
    regionStart: number
    readPositions: Uint32Array // offsets from regionStart
    readYs: Uint16Array
    readFlags: Uint16Array
    readMapqs: Uint8Array
    readAvgBaseQualities: Uint8Array
    readInsertSizes: Float32Array
    readPairOrientations: Uint8Array
    readStrands: Int8Array
    readTagColors: Uint8Array // RGB per read (3 bytes each), for tag coloring
    readChainHasSupp?: Uint8Array // 1 if chain contains supplementary reads
    readIds: string[]
    numReads: number
    maxY: number
    insertSizeStats?: { upper: number; lower: number }
    segmentPositions: Uint32Array
    segmentReadIndices: Uint32Array
    segmentEdgeFlags: Uint8Array
    numSegments: number
  }) {
    const gl = this.gl
    // Save old buffers reference, then null out to prevent render() from
    // drawing with stale data while we delete and recreate GL resources
    const oldBuffers = this.buffers
    this.buffers = null

    for (const buf of this.glBuffers) {
      gl.deleteBuffer(buf)
    }
    this.glBuffers = []
    if (oldBuffers) {
      this.deleteBuffersVAOs(oldBuffers)
    }
    // Clean up arc instance buffers
    for (const buf of this.arcInstanceBuffers) {
      gl.deleteBuffer(buf)
    }
    this.arcInstanceBuffers = []
    // Clean up connecting line buffers
    for (const buf of this.connectingLineGLBuffers) {
      gl.deleteBuffer(buf)
    }
    this.connectingLineGLBuffers = []

    if (data.numReads === 0) {
      const buffers = this.createEmptyBuffers(data.regionStart)
      buffers.readPositions = data.readPositions
      buffers.readYs = data.readYs
      buffers.readStrands = data.readStrands
      buffers.insertSizeStats = data.insertSizeStats
      this.buffers = buffers
      return
    }

    // Read VAO - uses per-segment instances (reads split at skip/intron gaps)
    const readVAO = gl.createVertexArray()
    gl.bindVertexArray(readVAO)

    const n = data.numSegments
    // Build per-segment attribute arrays by looking up parent read data
    const segPositions = data.segmentPositions
    const segYs = new Float32Array(n)
    const segFlags = new Float32Array(n)
    const segMapqs = new Float32Array(n)
    const segBaseQualities = new Float32Array(n)
    const segInsertSizes = new Float32Array(n)
    const segPairOrientations = new Float32Array(n)
    const segStrands = new Float32Array(n)
    const segTagColors =
      data.readTagColors.length > 0 ? new Uint8Array(n * 3) : null
    const segChainHasSupp =
      data.readChainHasSupp && data.readChainHasSupp.length > 0
        ? new Float32Array(n)
        : null
    const segReadIndices = new Uint32Array(n)
    const segEdgeFlags = new Uint32Array(n)
    const segReadSpans = new Uint32Array(n * 2)

    for (let j = 0; j < n; j++) {
      const ri = data.segmentReadIndices[j]!
      segYs[j] = data.readYs[ri]!
      segFlags[j] = data.readFlags[ri]!
      segMapqs[j] = data.readMapqs[ri]!
      segBaseQualities[j] = data.readAvgBaseQualities[ri]!
      segInsertSizes[j] = data.readInsertSizes[ri]!
      segPairOrientations[j] = data.readPairOrientations[ri]!
      segStrands[j] = data.readStrands[ri]!
      if (segTagColors) {
        segTagColors[j * 3] = data.readTagColors[ri * 3]!
        segTagColors[j * 3 + 1] = data.readTagColors[ri * 3 + 1]!
        segTagColors[j * 3 + 2] = data.readTagColors[ri * 3 + 2]!
      }
      if (segChainHasSupp) {
        segChainHasSupp[j] = data.readChainHasSupp![ri]!
      }
      segReadIndices[j] = ri
      segEdgeFlags[j] = data.segmentEdgeFlags[j]!
      segReadSpans[j * 2] = data.readPositions[ri * 2]!
      segReadSpans[j * 2 + 1] = data.readPositions[ri * 2 + 1]!
    }

    this.uploadUintBuffer(this.readProgram, 'a_position', segPositions, 2)
    this.uploadBuffer(this.readProgram, 'a_y', segYs, 1)
    this.uploadBuffer(this.readProgram, 'a_flags', segFlags, 1)
    this.uploadBuffer(this.readProgram, 'a_mapq', segMapqs, 1)
    this.uploadBuffer(this.readProgram, 'a_baseQuality', segBaseQualities, 1)
    this.uploadBuffer(this.readProgram, 'a_insertSize', segInsertSizes, 1)
    this.uploadBuffer(
      this.readProgram,
      'a_pairOrientation',
      segPairOrientations,
      1,
    )
    this.uploadBuffer(this.readProgram, 'a_strand', segStrands, 1)
    if (segTagColors) {
      this.uploadNormalizedByteBuffer(
        this.readProgram,
        'a_tagColor',
        segTagColors,
        3,
      )
    } else {
      const loc = gl.getAttribLocation(this.readProgram, 'a_tagColor')
      if (loc >= 0) {
        gl.disableVertexAttribArray(loc)
        gl.vertexAttrib3f(loc, 0, 0, 0)
      }
    }
    if (segChainHasSupp) {
      this.uploadBuffer(this.readProgram, 'a_chainHasSupp', segChainHasSupp, 1)
    } else {
      const loc = gl.getAttribLocation(this.readProgram, 'a_chainHasSupp')
      if (loc >= 0) {
        gl.disableVertexAttribArray(loc)
        gl.vertexAttrib1f(loc, 0)
      }
    }
    this.uploadUintBuffer(this.readProgram, 'a_readIndex', segReadIndices, 1)
    this.uploadUintBuffer(this.readProgram, 'a_edgeFlags', segEdgeFlags, 1)
    this.uploadUintBuffer(this.readProgram, 'a_readSpan', segReadSpans, 2)
    gl.bindVertexArray(null)

    const readIdToIndex = new Map<string, number>()
    for (let i = 0; i < data.numReads; i++) {
      readIdToIndex.set(data.readIds[i]!, i)
    }
    const buffers = this.createEmptyBuffers(data.regionStart)
    buffers.readIdToIndex = readIdToIndex
    buffers.readVAO = readVAO
    buffers.segmentCount = n
    buffers.readPositions = data.readPositions
    buffers.readYs = data.readYs
    buffers.readStrands = data.readStrands
    buffers.insertSizeStats = data.insertSizeStats
    this.buffers = buffers
  }

  /**
   * Upload CIGAR data from pre-computed typed arrays (from RPC worker)
   * Accepts optimized integer types and converts to float for GPU
   */
  uploadCigarFromTypedArrays(data: {
    gapPositions: Uint32Array
    gapYs: Uint16Array
    gapTypes: Uint8Array
    gapFrequencies: Uint8Array
    numGaps: number
    mismatchPositions: Uint32Array
    mismatchYs: Uint16Array
    mismatchBases: Uint8Array
    mismatchFrequencies: Uint8Array
    numMismatches: number
    interbasePositions: Uint32Array
    interbaseYs: Uint16Array
    interbaseLengths: Uint16Array
    interbaseTypes: Uint8Array
    interbaseFrequencies: Uint8Array
    numInterbases: number
    softclipBasePositions: Uint32Array
    softclipBaseYs: Uint16Array
    softclipBaseBases: Uint8Array
    numSoftclipBases: number
  }) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    // Clean up old CIGAR VAOs
    const cigarVaoKeys = [
      'gapVAO',
      'mismatchVAO',
      'insertionVAO',
      'softclipVAO',
      'softclipBaseVAO',
      'hardclipVAO',
    ] as const
    for (const key of cigarVaoKeys) {
      if (this.buffers[key]) {
        gl.deleteVertexArray(this.buffers[key])
        this.buffers[key] = null
      }
    }

    // Upload gaps - use integer buffers directly (no Float32 conversion)
    if (data.numGaps > 0) {
      const gapVAO = gl.createVertexArray()
      gl.bindVertexArray(gapVAO)
      this.uploadUintBuffer(this.gapProgram, 'a_position', data.gapPositions, 2)
      this.uploadUint16Buffer(this.gapProgram, 'a_y', data.gapYs, 1)
      this.uploadUint8Buffer(this.gapProgram, 'a_type', data.gapTypes, 1)
      this.uploadNormalizedUint8Buffer(
        this.gapProgram,
        'a_frequency',
        data.gapFrequencies,
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.gapVAO = gapVAO
      this.buffers.gapCount = data.numGaps
    } else {
      this.buffers.gapCount = 0
    }

    // Upload mismatches - use integer buffers directly
    if (data.numMismatches > 0) {
      const mismatchVAO = gl.createVertexArray()
      gl.bindVertexArray(mismatchVAO)
      this.uploadUintBuffer(
        this.mismatchProgram,
        'a_position',
        data.mismatchPositions,
        1,
      )
      this.uploadUint16Buffer(this.mismatchProgram, 'a_y', data.mismatchYs, 1)
      this.uploadUint8Buffer(
        this.mismatchProgram,
        'a_base',
        data.mismatchBases,
        1,
      )
      this.uploadNormalizedUint8Buffer(
        this.mismatchProgram,
        'a_frequency',
        data.mismatchFrequencies,
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.mismatchVAO = mismatchVAO
      this.buffers.mismatchCount = data.numMismatches
    } else {
      this.buffers.mismatchCount = 0
    }

    const insertionIndices: number[] = []
    const softclipIndices: number[] = []
    const hardclipIndices: number[] = []

    for (let i = 0; i < data.numInterbases; i++) {
      const interbaseType = data.interbaseTypes[i]
      if (interbaseType === INTERBASE_INSERTION) {
        insertionIndices.push(i)
      } else if (interbaseType === INTERBASE_SOFTCLIP) {
        softclipIndices.push(i)
      } else if (interbaseType === INTERBASE_HARDCLIP) {
        hardclipIndices.push(i)
      }
    }

    const uploadInterbaseType = (indices: number[], program: WebGLProgram) => {
      if (indices.length === 0) {
        return { vao: null as WebGLVertexArrayObject | null, count: 0 }
      }
      const vao = gl.createVertexArray()
      gl.bindVertexArray(vao)

      const positions = new Uint32Array(indices.length)
      const ys = new Uint16Array(indices.length)
      const lengths = new Uint16Array(indices.length)
      const frequencies = new Uint8Array(indices.length)

      for (let j = 0; j < indices.length; j++) {
        const i = indices[j]!
        positions[j] = data.interbasePositions[i]!
        ys[j] = data.interbaseYs[i]!
        lengths[j] = data.interbaseLengths[i]!
        frequencies[j] = data.interbaseFrequencies[i]!
      }

      this.uploadUintBuffer(program, 'a_position', positions, 1)
      this.uploadUint16Buffer(program, 'a_y', ys, 1)
      this.uploadUint16Buffer(program, 'a_length', lengths, 1)
      this.uploadNormalizedUint8Buffer(program, 'a_frequency', frequencies, 1)
      gl.bindVertexArray(null)

      return { vao, count: indices.length }
    }

    const ins = uploadInterbaseType(insertionIndices, this.insertionProgram)
    this.buffers.insertionVAO = ins.vao
    this.buffers.insertionCount = ins.count

    const sc = uploadInterbaseType(softclipIndices, this.softclipProgram)
    this.buffers.softclipVAO = sc.vao
    this.buffers.softclipCount = sc.count

    // Upload soft clip bases (per-base colored rectangles for showSoftClipping)
    if (data.numSoftclipBases > 0) {
      const softclipBaseVAO = gl.createVertexArray()
      gl.bindVertexArray(softclipBaseVAO)
      this.uploadUintBuffer(
        this.mismatchProgram,
        'a_position',
        data.softclipBasePositions,
        1,
      )
      this.uploadUint16Buffer(
        this.mismatchProgram,
        'a_y',
        data.softclipBaseYs,
        1,
      )
      this.uploadUint8Buffer(
        this.mismatchProgram,
        'a_base',
        data.softclipBaseBases,
        1,
      )
      // frequency=0 → sub-pixel alpha when zoomed out (same fading as rare mismatches)
      const frequencies = new Uint8Array(data.numSoftclipBases)
      this.uploadNormalizedUint8Buffer(
        this.mismatchProgram,
        'a_frequency',
        frequencies,
        1,
      )
      gl.bindVertexArray(null)
      this.buffers.softclipBaseVAO = softclipBaseVAO
      this.buffers.softclipBaseCount = data.numSoftclipBases
    } else {
      this.buffers.softclipBaseCount = 0
    }

    const hc = uploadInterbaseType(hardclipIndices, this.hardclipProgram)
    this.buffers.hardclipVAO = hc.vao
    this.buffers.hardclipCount = hc.count
  }

  /**
   * Upload coverage data from pre-computed typed arrays (from RPC worker)
   */
  /**
   * Upload coverage data from pre-computed typed arrays
   * Positions are offsets from regionStart
   */
  uploadCoverageFromTypedArrays(data: {
    coverageDepths: Float32Array
    coverageMaxDepth: number
    coverageStartOffset: number // offset from regionStart where coverage begins
    numCoverageBins: number
    snpPositions: Uint32Array // offsets from regionStart
    snpYOffsets: Float32Array
    snpHeights: Float32Array
    snpColorTypes: Uint8Array
    numSnpSegments: number
    // Noncov (interbase) coverage data
    noncovPositions: Uint32Array
    noncovYOffsets: Float32Array
    noncovHeights: Float32Array
    noncovColorTypes: Uint8Array
    noncovMaxCount: number
    numNoncovSegments: number
    // Indicator data
    indicatorPositions: Uint32Array
    indicatorColorTypes: Uint8Array
    numIndicators: number
  }) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    // Clean up old coverage VAOs
    if (this.buffers.coverageVAO) {
      gl.deleteVertexArray(this.buffers.coverageVAO)
    }
    if (this.buffers.snpCoverageVAO) {
      gl.deleteVertexArray(this.buffers.snpCoverageVAO)
    }
    if (this.buffers.noncovHistogramVAO) {
      gl.deleteVertexArray(this.buffers.noncovHistogramVAO)
    }
    if (this.buffers.indicatorVAO) {
      gl.deleteVertexArray(this.buffers.indicatorVAO)
    }

    // Upload grey coverage bars with explicit positions
    if (data.numCoverageBins > 0) {
      // Generate position array (offsets from regionStart)
      // coverageStartOffset indicates where coverage begins relative to regionStart
      // (can be negative if features extend before regionStart)
      const positions = new Float32Array(data.numCoverageBins)
      for (let i = 0; i < data.numCoverageBins; i++) {
        positions[i] = data.coverageStartOffset + i
      }

      // Normalize depths
      const normalizedDepths = new Float32Array(data.coverageDepths.length)
      for (let i = 0; i < data.coverageDepths.length; i++) {
        normalizedDepths[i] =
          (data.coverageDepths[i] ?? 0) / data.coverageMaxDepth
      }

      const coverageVAO = gl.createVertexArray()
      gl.bindVertexArray(coverageVAO)
      this.uploadBuffer(this.coverageProgram, 'a_position', positions, 1)
      this.uploadBuffer(this.coverageProgram, 'a_depth', normalizedDepths, 1)
      gl.bindVertexArray(null)

      this.buffers.coverageVAO = coverageVAO
      this.buffers.coverageCount = data.numCoverageBins
      this.buffers.maxDepth = data.coverageMaxDepth
      this.buffers.binSize = 1
    } else {
      this.buffers.coverageVAO = null
      this.buffers.coverageCount = 0
    }

    // Upload SNP coverage - convert Uint32Array positions and Uint8Array colors to Float32 for GPU
    if (data.numSnpSegments > 0) {
      const snpCoverageVAO = gl.createVertexArray()
      gl.bindVertexArray(snpCoverageVAO)
      this.uploadBuffer(
        this.snpCoverageProgram,
        'a_position',
        new Float32Array(data.snpPositions),
        1,
      )
      this.uploadBuffer(
        this.snpCoverageProgram,
        'a_yOffset',
        data.snpYOffsets,
        1,
      )
      this.uploadBuffer(
        this.snpCoverageProgram,
        'a_segmentHeight',
        data.snpHeights,
        1,
      )
      this.uploadBuffer(
        this.snpCoverageProgram,
        'a_colorType',
        new Float32Array(data.snpColorTypes),
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.snpCoverageVAO = snpCoverageVAO
      this.buffers.snpCoverageCount = data.numSnpSegments
    } else {
      this.buffers.snpCoverageVAO = null
      this.buffers.snpCoverageCount = 0
    }

    // Upload noncov (interbase) histogram - insertion/softclip/hardclip counts
    if (data.numNoncovSegments > 0) {
      const noncovHistogramVAO = gl.createVertexArray()
      gl.bindVertexArray(noncovHistogramVAO)
      this.uploadBuffer(
        this.noncovHistogramProgram,
        'a_position',
        new Float32Array(data.noncovPositions),
        1,
      )
      this.uploadBuffer(
        this.noncovHistogramProgram,
        'a_yOffset',
        data.noncovYOffsets,
        1,
      )
      this.uploadBuffer(
        this.noncovHistogramProgram,
        'a_segmentHeight',
        data.noncovHeights,
        1,
      )
      this.uploadBuffer(
        this.noncovHistogramProgram,
        'a_colorType',
        new Float32Array(data.noncovColorTypes),
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.noncovHistogramVAO = noncovHistogramVAO
      this.buffers.noncovHistogramCount = data.numNoncovSegments
      this.buffers.noncovMaxCount = data.noncovMaxCount
    } else {
      this.buffers.noncovHistogramVAO = null
      this.buffers.noncovHistogramCount = 0
      this.buffers.noncovMaxCount = 0
    }

    // Upload interbase indicators - triangles at significant positions
    if (data.numIndicators > 0) {
      const indicatorVAO = gl.createVertexArray()
      gl.bindVertexArray(indicatorVAO)
      this.uploadBuffer(
        this.indicatorProgram,
        'a_position',
        new Float32Array(data.indicatorPositions),
        1,
      )
      this.uploadBuffer(
        this.indicatorProgram,
        'a_colorType',
        new Float32Array(data.indicatorColorTypes),
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.indicatorVAO = indicatorVAO
      this.buffers.indicatorCount = data.numIndicators
    } else {
      this.buffers.indicatorVAO = null
      this.buffers.indicatorCount = 0
    }
  }

  uploadModificationsFromTypedArrays(data: {
    modificationPositions: Uint32Array
    modificationYs: Uint16Array
    modificationColors: Uint8Array // RGBA packed, 4 bytes per modification
    numModifications: number
  }) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    if (this.buffers.modificationVAO) {
      gl.deleteVertexArray(this.buffers.modificationVAO)
      this.buffers.modificationVAO = null
    }

    if (data.numModifications > 0) {
      const modificationVAO = gl.createVertexArray()
      gl.bindVertexArray(modificationVAO)
      this.uploadUintBuffer(
        this.modificationProgram,
        'a_position',
        data.modificationPositions,
        1,
      )
      this.uploadUint16Buffer(
        this.modificationProgram,
        'a_y',
        data.modificationYs,
        1,
      )
      // Upload RGBA color as normalized unsigned bytes (gl.UNSIGNED_BYTE with normalize=true)
      this.uploadNormalizedUint8Buffer(
        this.modificationProgram,
        'a_color',
        data.modificationColors,
        4,
      )
      gl.bindVertexArray(null)

      this.buffers.modificationVAO = modificationVAO
      this.buffers.modificationCount = data.numModifications
    } else {
      this.buffers.modificationCount = 0
    }
  }

  uploadModCoverageFromTypedArrays(data: {
    modCovPositions: Uint32Array
    modCovYOffsets: Float32Array
    modCovHeights: Float32Array
    modCovColors: Uint8Array // packed RGBA, 4 bytes per segment
    numModCovSegments: number
  }) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    if (this.buffers.modCoverageVAO) {
      gl.deleteVertexArray(this.buffers.modCoverageVAO)
      this.buffers.modCoverageVAO = null
    }

    if (data.numModCovSegments > 0) {
      const modCoverageVAO = gl.createVertexArray()
      gl.bindVertexArray(modCoverageVAO)
      this.uploadBuffer(
        this.modCoverageProgram,
        'a_position',
        new Float32Array(data.modCovPositions),
        1,
      )
      this.uploadBuffer(
        this.modCoverageProgram,
        'a_yOffset',
        data.modCovYOffsets,
        1,
      )
      this.uploadBuffer(
        this.modCoverageProgram,
        'a_segmentHeight',
        data.modCovHeights,
        1,
      )
      this.uploadNormalizedUint8Buffer(
        this.modCoverageProgram,
        'a_color',
        data.modCovColors,
        4,
      )
      gl.bindVertexArray(null)

      this.buffers.modCoverageVAO = modCoverageVAO
      this.buffers.modCoverageCount = data.numModCovSegments
    } else {
      this.buffers.modCoverageCount = 0
    }
  }

  private uploadBuffer(
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
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  /**
   * Upload unsigned integer buffer for high-precision position attributes
   * Uses vertexAttribIPointer to pass integers directly to shader
   */
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
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_INT, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  /**
   * Upload Uint16Array as unsigned short integer attribute
   */
  private uploadUint16Buffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint16Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_SHORT, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  /**
   * Upload Uint8Array as normalized float attribute (0-255 → 0.0-1.0)
   * Used for per-instance color data stored as bytes
   */
  private uploadNormalizedByteBuffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint8Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.UNSIGNED_BYTE, true, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  /**
   * Upload Uint8Array as unsigned byte integer attribute
   */
  private uploadUint8Buffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint8Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_BYTE, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  /**
   * Upload Uint8Array as normalized float attribute (0-255 -> 0.0-1.0)
   * Used for RGBA colors where shader receives vec4 in 0-1 range
   */
  private uploadNormalizedUint8Buffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint8Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    // normalize=true converts Uint8 0-255 to float 0.0-1.0
    gl.vertexAttribPointer(loc, size, gl.UNSIGNED_BYTE, true, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  private createEmptyBuffers(regionStart: number): GPUBuffers {
    const gl = this.gl
    const emptyVAO = gl.createVertexArray()
    gl.bindVertexArray(emptyVAO)
    gl.bindVertexArray(null)
    return {
      regionStart,
      readIdToIndex: new Map(),
      readVAO: emptyVAO,
      segmentCount: 0,
      readPositions: new Uint32Array(0),
      readYs: new Uint16Array(0),
      readStrands: new Int8Array(0),
      coverageVAO: null,
      coverageCount: 0,
      maxDepth: 0,
      binSize: 1,
      snpCoverageVAO: null,
      snpCoverageCount: 0,
      noncovHistogramVAO: null,
      noncovHistogramCount: 0,
      noncovMaxCount: 0,
      indicatorVAO: null,
      indicatorCount: 0,
      gapVAO: null,
      gapCount: 0,
      mismatchVAO: null,
      mismatchCount: 0,
      insertionVAO: null,
      insertionCount: 0,
      softclipVAO: null,
      softclipCount: 0,
      softclipBaseVAO: null,
      softclipBaseCount: 0,
      hardclipVAO: null,
      hardclipCount: 0,
      modificationVAO: null,
      modificationCount: 0,
      modCoverageVAO: null,
      modCoverageCount: 0,
      arcVAO: null,
      arcCount: 0,
      arcLineVAO: null,
      arcLineCount: 0,
      connectingLineVAO: null,
      connectingLineCount: 0,
      sashimiVAO: null,
      sashimiCount: 0,
      insertSizeStats: undefined,
    }
  }

  ensureBuffers(regionStart: number) {
    if (!this.buffers) {
      this.buffers = this.createEmptyBuffers(regionStart)
    }
  }

  /**
   * Upload arcs data from pre-computed typed arrays (from RPC worker)
   */
  uploadArcsFromTypedArrays(data: {
    regionStart: number
    arcX1: Float32Array
    arcX2: Float32Array
    arcColorTypes: Float32Array
    arcIsArc: Uint8Array
    numArcs: number
    linePositions: Uint32Array
    lineYs: Float32Array
    lineColorTypes: Float32Array
    numLines: number
  }) {
    const gl = this.gl
    this.ensureBuffers(data.regionStart)

    if (!this.buffers || !this.arcProgram || !this.arcLineProgram) {
      return
    }

    // Clean up old arcs VAOs
    if (this.buffers.arcVAO) {
      gl.deleteVertexArray(this.buffers.arcVAO)
      this.buffers.arcVAO = null
    }
    if (this.buffers.arcLineVAO) {
      gl.deleteVertexArray(this.buffers.arcLineVAO)
      this.buffers.arcLineVAO = null
    }
    for (const buf of this.arcInstanceBuffers) {
      gl.deleteBuffer(buf)
    }
    this.arcInstanceBuffers = []

    if (data.numArcs > 0) {
      const arcVAO = gl.createVertexArray()
      gl.bindVertexArray(arcVAO)

      const stride = 2 * 4 // 2 floats * 4 bytes

      // Per-vertex: template t values
      const tLoc = gl.getAttribLocation(this.arcProgram, 'a_t')
      gl.bindBuffer(gl.ARRAY_BUFFER, this.arcTemplateBuffer)
      gl.enableVertexAttribArray(tLoc)
      gl.vertexAttribPointer(tLoc, 1, gl.FLOAT, false, stride, 0)

      // Per-vertex: side (-1 or +1)
      const sideLoc = gl.getAttribLocation(this.arcProgram, 'a_side')
      gl.bindBuffer(gl.ARRAY_BUFFER, this.arcTemplateBuffer)
      gl.enableVertexAttribArray(sideLoc)
      gl.vertexAttribPointer(sideLoc, 1, gl.FLOAT, false, stride, 4)

      // Per-instance: a_x1
      const x1Buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, x1Buf)
      gl.bufferData(gl.ARRAY_BUFFER, data.arcX1, gl.STATIC_DRAW)
      const x1Loc = gl.getAttribLocation(this.arcProgram, 'a_x1')
      gl.enableVertexAttribArray(x1Loc)
      gl.vertexAttribPointer(x1Loc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(x1Loc, 1)
      this.arcInstanceBuffers.push(x1Buf)

      // Per-instance: a_x2
      const x2Buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, x2Buf)
      gl.bufferData(gl.ARRAY_BUFFER, data.arcX2, gl.STATIC_DRAW)
      const x2Loc = gl.getAttribLocation(this.arcProgram, 'a_x2')
      gl.enableVertexAttribArray(x2Loc)
      gl.vertexAttribPointer(x2Loc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(x2Loc, 1)
      this.arcInstanceBuffers.push(x2Buf)

      // Per-instance: a_colorType
      const colorBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf)
      gl.bufferData(gl.ARRAY_BUFFER, data.arcColorTypes, gl.STATIC_DRAW)
      const colorLoc = gl.getAttribLocation(this.arcProgram, 'a_colorType')
      gl.enableVertexAttribArray(colorLoc)
      gl.vertexAttribPointer(colorLoc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(colorLoc, 1)
      this.arcInstanceBuffers.push(colorBuf)

      // Per-instance: a_isArc (Uint8 → float)
      const isArcFloat = new Float32Array(data.arcIsArc.length)
      for (let i = 0; i < data.arcIsArc.length; i++) {
        isArcFloat[i] = data.arcIsArc[i]!
      }
      const isArcBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, isArcBuf)
      gl.bufferData(gl.ARRAY_BUFFER, isArcFloat, gl.STATIC_DRAW)
      const isArcLoc = gl.getAttribLocation(this.arcProgram, 'a_isArc')
      gl.enableVertexAttribArray(isArcLoc)
      gl.vertexAttribPointer(isArcLoc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(isArcLoc, 1)
      this.arcInstanceBuffers.push(isArcBuf)

      gl.bindVertexArray(null)
      this.buffers.arcVAO = arcVAO
      this.buffers.arcCount = data.numArcs
    } else {
      this.buffers.arcCount = 0
    }

    // Lines for inter-chromosomal / long-range connections
    if (data.numLines > 0) {
      const arcLineVAO = gl.createVertexArray()
      gl.bindVertexArray(arcLineVAO)

      const posLoc = gl.getAttribLocation(this.arcLineProgram, 'a_position')
      const posBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
      gl.bufferData(gl.ARRAY_BUFFER, data.linePositions, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(posLoc)
      gl.vertexAttribIPointer(posLoc, 1, gl.UNSIGNED_INT, 0, 0)
      this.arcInstanceBuffers.push(posBuf)

      const yLoc = gl.getAttribLocation(this.arcLineProgram, 'a_y')
      const yBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, yBuf)
      gl.bufferData(gl.ARRAY_BUFFER, data.lineYs, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(yLoc)
      gl.vertexAttribPointer(yLoc, 1, gl.FLOAT, false, 0, 0)
      this.arcInstanceBuffers.push(yBuf)

      const colorLoc = gl.getAttribLocation(this.arcLineProgram, 'a_colorType')
      const colorBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf)
      gl.bufferData(gl.ARRAY_BUFFER, data.lineColorTypes, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(colorLoc)
      gl.vertexAttribPointer(colorLoc, 1, gl.FLOAT, false, 0, 0)
      this.arcInstanceBuffers.push(colorBuf)

      gl.bindVertexArray(null)
      this.buffers.arcLineVAO = arcLineVAO
      this.buffers.arcLineCount = data.numLines
    } else {
      this.buffers.arcLineCount = 0
    }
  }

  /**
   * Upload sashimi arc data from pre-computed typed arrays (splice junctions)
   */
  uploadSashimiFromTypedArrays(data: {
    sashimiX1: Float32Array
    sashimiX2: Float32Array
    sashimiScores: Float32Array
    sashimiColorTypes: Uint8Array
    numSashimiArcs: number
  }) {
    const gl = this.gl

    if (!this.buffers || !this.sashimiProgram) {
      return
    }

    // Clean up old sashimi VAO
    if (this.buffers.sashimiVAO) {
      gl.deleteVertexArray(this.buffers.sashimiVAO)
      this.buffers.sashimiVAO = null
    }
    for (const buf of this.sashimiInstanceBuffers) {
      gl.deleteBuffer(buf)
    }
    this.sashimiInstanceBuffers = []

    if (data.numSashimiArcs > 0) {
      const sashimiVAO = gl.createVertexArray()
      gl.bindVertexArray(sashimiVAO)

      const stride = 2 * 4 // 2 floats * 4 bytes

      // Per-vertex: template t values (reuse arcTemplateBuffer)
      const tLoc = gl.getAttribLocation(this.sashimiProgram, 'a_t')
      gl.bindBuffer(gl.ARRAY_BUFFER, this.arcTemplateBuffer)
      gl.enableVertexAttribArray(tLoc)
      gl.vertexAttribPointer(tLoc, 1, gl.FLOAT, false, stride, 0)

      // Per-vertex: side (-1 or +1)
      const sideLoc = gl.getAttribLocation(this.sashimiProgram, 'a_side')
      gl.bindBuffer(gl.ARRAY_BUFFER, this.arcTemplateBuffer)
      gl.enableVertexAttribArray(sideLoc)
      gl.vertexAttribPointer(sideLoc, 1, gl.FLOAT, false, stride, 4)

      // Per-instance: a_x1
      const x1Buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, x1Buf)
      gl.bufferData(gl.ARRAY_BUFFER, data.sashimiX1, gl.STATIC_DRAW)
      const x1Loc = gl.getAttribLocation(this.sashimiProgram, 'a_x1')
      gl.enableVertexAttribArray(x1Loc)
      gl.vertexAttribPointer(x1Loc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(x1Loc, 1)
      this.sashimiInstanceBuffers.push(x1Buf)

      // Per-instance: a_x2
      const x2Buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, x2Buf)
      gl.bufferData(gl.ARRAY_BUFFER, data.sashimiX2, gl.STATIC_DRAW)
      const x2Loc = gl.getAttribLocation(this.sashimiProgram, 'a_x2')
      gl.enableVertexAttribArray(x2Loc)
      gl.vertexAttribPointer(x2Loc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(x2Loc, 1)
      this.sashimiInstanceBuffers.push(x2Buf)

      // Per-instance: a_colorType
      const colorFloat = new Float32Array(data.sashimiColorTypes.length)
      for (let i = 0; i < data.sashimiColorTypes.length; i++) {
        colorFloat[i] = data.sashimiColorTypes[i]!
      }
      const colorBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf)
      gl.bufferData(gl.ARRAY_BUFFER, colorFloat, gl.STATIC_DRAW)
      const colorLoc = gl.getAttribLocation(this.sashimiProgram, 'a_colorType')
      gl.enableVertexAttribArray(colorLoc)
      gl.vertexAttribPointer(colorLoc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(colorLoc, 1)
      this.sashimiInstanceBuffers.push(colorBuf)

      // Per-instance: a_lineWidth (from sashimiScores)
      const lwBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, lwBuf)
      gl.bufferData(gl.ARRAY_BUFFER, data.sashimiScores, gl.STATIC_DRAW)
      const lwLoc = gl.getAttribLocation(this.sashimiProgram, 'a_lineWidth')
      gl.enableVertexAttribArray(lwLoc)
      gl.vertexAttribPointer(lwLoc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(lwLoc, 1)
      this.sashimiInstanceBuffers.push(lwBuf)

      gl.bindVertexArray(null)
      this.buffers.sashimiVAO = sashimiVAO
      this.buffers.sashimiCount = data.numSashimiArcs
    } else {
      this.buffers.sashimiCount = 0
    }
  }

  /**
   * Upload sashimi data for a specific region
   */
  uploadSashimiFromTypedArraysForRegion(
    regionNumber: number,
    data: SashimiUploadData,
  ) {
    this.activateRegion(regionNumber)
    this.uploadSashimiFromTypedArrays(data)
    this.deactivateRegion(regionNumber)
  }

  /**
   * Clear legacy single-entry state (this.buffers, this.glBuffers, etc.)
   * that may have been populated by direct (non-per-refName) uploads.
   * Call once before starting per-refName uploads to prevent GPU resource leaks.
   */
  clearLegacyBuffers() {
    const gl = this.gl
    if (this.buffers) {
      this.deleteBuffersVAOs(this.buffers)
      this.buffers = null
    }
    for (const buf of this.glBuffers) {
      gl.deleteBuffer(buf)
    }
    this.glBuffers = []
    for (const buf of this.arcInstanceBuffers) {
      gl.deleteBuffer(buf)
    }
    this.arcInstanceBuffers = []
    for (const buf of this.sashimiInstanceBuffers) {
      gl.deleteBuffer(buf)
    }
    this.sashimiInstanceBuffers = []
    for (const buf of this.connectingLineGLBuffers) {
      gl.deleteBuffer(buf)
    }
    this.connectingLineGLBuffers = []
  }

  /**
   * Switch internal state to point at a specific region's buffers.
   * Call before using existing upload methods for per-region data.
   */
  private activateRegion(regionNumber: number) {
    this.buffers = this.buffersMap.get(regionNumber) ?? null
    this.glBuffers = this.glBuffersMap.get(regionNumber) ?? []
    this.arcInstanceBuffers = this.arcInstanceBuffersMap.get(regionNumber) ?? []
    this.sashimiInstanceBuffers =
      this.sashimiInstanceBuffersMap.get(regionNumber) ?? []
    this.connectingLineGLBuffers =
      this.connectingLineGLBuffersMap.get(regionNumber) ?? []
  }

  /**
   * Save internal state back to the map for the given region.
   * Call after upload methods complete.
   */
  private deactivateRegion(regionNumber: number) {
    if (this.buffers) {
      this.buffersMap.set(regionNumber, this.buffers)
    }
    this.glBuffersMap.set(regionNumber, this.glBuffers)
    this.arcInstanceBuffersMap.set(regionNumber, this.arcInstanceBuffers)
    this.sashimiInstanceBuffersMap.set(
      regionNumber,
      this.sashimiInstanceBuffers,
    )
    this.connectingLineGLBuffersMap.set(
      regionNumber,
      this.connectingLineGLBuffers,
    )
    // Reset to null so stale pointers don't linger
    this.buffers = null
    this.glBuffers = []
    this.arcInstanceBuffers = []
    this.sashimiInstanceBuffers = []
    this.connectingLineGLBuffers = []
  }

  private withRegion<T>(regionNumber: number, fn: (data: T) => void, data: T) {
    this.activateRegion(regionNumber)
    fn.call(this, data)
    this.deactivateRegion(regionNumber)
  }

  uploadFromTypedArraysForRegion(regionNumber: number, data: ReadUploadData) {
    this.withRegion(regionNumber, this.uploadFromTypedArrays, data)
  }

  uploadCigarFromTypedArraysForRegion(
    regionNumber: number,
    data: CigarUploadData,
  ) {
    this.withRegion(regionNumber, this.uploadCigarFromTypedArrays, data)
  }

  uploadCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: CoverageUploadData,
  ) {
    this.withRegion(regionNumber, this.uploadCoverageFromTypedArrays, data)
  }

  uploadModificationsFromTypedArraysForRegion(
    regionNumber: number,
    data: ModificationUploadData,
  ) {
    this.withRegion(regionNumber, this.uploadModificationsFromTypedArrays, data)
  }

  uploadModCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: ModCoverageUploadData,
  ) {
    this.withRegion(regionNumber, this.uploadModCoverageFromTypedArrays, data)
  }

  uploadArcsFromTypedArraysForRegion(
    regionNumber: number,
    data: ArcsUploadData,
  ) {
    this.withRegion(regionNumber, this.uploadArcsFromTypedArrays, data)
  }

  /**
   * Upload connecting line data from pre-computed typed arrays
   */
  uploadConnectingLinesFromTypedArrays(data: {
    regionStart: number
    connectingLinePositions: Uint32Array
    connectingLineYs: Uint16Array
    connectingLineColorTypes: Uint8Array
    numConnectingLines: number
  }) {
    const gl = this.gl
    this.ensureBuffers(data.regionStart)

    if (!this.buffers || !this.connectingLineProgram) {
      return
    }

    if (this.buffers.connectingLineVAO) {
      gl.deleteVertexArray(this.buffers.connectingLineVAO)
      this.buffers.connectingLineVAO = null
    }
    for (const buf of this.connectingLineGLBuffers) {
      gl.deleteBuffer(buf)
    }
    this.connectingLineGLBuffers = []

    if (data.numConnectingLines === 0) {
      this.buffers.connectingLineCount = 0
      return
    }

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    this.uploadConnectingLineBuffer(
      this.connectingLineProgram,
      'a_position',
      data.connectingLinePositions,
      2,
      true,
    )
    this.uploadConnectingLineBuffer(
      this.connectingLineProgram,
      'a_y',
      new Float32Array(data.connectingLineYs),
      1,
      false,
    )
    gl.bindVertexArray(null)
    this.buffers.connectingLineVAO = vao
    this.buffers.connectingLineCount = data.numConnectingLines
  }

  private uploadConnectingLineBuffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint32Array | Float32Array,
    size: number,
    isUint: boolean,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }
    const buffer = gl.createBuffer()
    this.connectingLineGLBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    if (isUint) {
      gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_INT, 0, 0)
    } else {
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    }
    gl.vertexAttribDivisor(loc, 1)
  }

  uploadConnectingLinesForRegion(
    regionNumber: number,
    data: ConnectingLinesUploadData,
  ) {
    this.activateRegion(regionNumber)
    this.uploadConnectingLinesFromTypedArrays(data)
    this.deactivateRegion(regionNumber)
  }

  /**
   * Render multiple blocks with scissor rects, each from a different refName's GPU buffers.
   */
  renderBlocks(blocks: RenderBlock[], state: RenderState) {
    const gl = this.gl
    const canvas = this.canvas
    const { canvasWidth, canvasHeight } = state
    this.dpr = window.devicePixelRatio || 1
    const dpr = this.dpr

    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    const bufW = Math.min(Math.round(canvasWidth * dpr), maxTex)
    const bufH = Math.min(Math.round(canvasHeight * dpr), maxTex)
    if (canvas.width !== bufW || canvas.height !== bufH) {
      canvas.width = bufW
      canvas.height = bufH
    }

    gl.viewport(0, 0, bufW, bufH)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const colors = state.colors
    const mode = state.renderingMode ?? 'pileup'

    // Phase 1: Per-block rendering (coverage, pileup, connecting lines, arc lines)
    for (const block of blocks) {
      const buffers = this.buffersMap.get(block.regionNumber)
      if (!buffers) {
        continue
      }

      this.buffers = buffers

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }
      gl.enable(gl.SCISSOR_TEST)
      gl.scissor(
        Math.round(scissorX * dpr),
        0,
        Math.round(scissorW * dpr),
        bufH,
      )

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const bpPerPx =
        fullBlockWidth > 0
          ? (block.bpRangeX[1] - block.bpRangeX[0]) / fullBlockWidth
          : 1
      const clippedBpStart =
        block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedBpEnd =
        block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx

      gl.viewport(
        Math.round(scissorX * dpr),
        0,
        Math.round(scissorW * dpr),
        bufH,
      )
      const blockState: RenderState = {
        ...state,
        bpRangeX: [clippedBpStart, clippedBpEnd] as [number, number],
        canvasWidth: scissorW,
      }

      renderCoverage(this, blockState, colors)

      const arcsHeight =
        state.showArcs && state.arcsHeight ? state.arcsHeight : 0
      const covH = state.showCoverage ? state.coverageHeight : 0

      // Arc lines still rendered per-block (they use HP precision, short vertical lines)
      if (arcsHeight > 0) {
        const covHPx = Math.round(covH * dpr)
        const effectiveArcsHPx = Math.min(
          Math.round(arcsHeight * dpr),
          Math.max(0, bufH - covHPx),
        )
        if (effectiveArcsHPx > 0) {
          const arcsY = bufH - covHPx - effectiveArcsHPx
          gl.viewport(0, arcsY, bufW, effectiveArcsHPx)
          gl.scissor(
            Math.round(scissorX * dpr),
            arcsY,
            Math.round(scissorW * dpr),
            effectiveArcsHPx,
          )
          renderArcLines(
            this,
            {
              ...state,
              bpRangeX: block.bpRangeX,
              showCoverage: false,
              coverageHeight: 0,
              canvasHeight: effectiveArcsHPx / dpr,
            },
            block.screenStartPx,
            fullBlockWidth,
          )
          gl.viewport(
            Math.round(scissorX * dpr),
            0,
            Math.round(scissorW * dpr),
            bufH,
          )
          gl.scissor(
            Math.round(scissorX * dpr),
            0,
            Math.round(scissorW * dpr),
            bufH,
          )
        }
      }
      const pileupTopPx = Math.round((covH + arcsHeight) * dpr)
      const pileupHPx = Math.max(0, bufH - pileupTopPx)
      if (pileupHPx > 0) {
        gl.scissor(
          Math.round(scissorX * dpr),
          0,
          Math.round(scissorW * dpr),
          pileupHPx,
        )
      }

      if (mode === 'linkedRead') {
        renderConnectingLine(this, blockState)
      }

      renderPileup(this, blockState, colors, scissorX)
    }

    // Phase 2: Cross-region rendering (arcs and sashimi arcs)
    // Rendered without scissor clipping so arcs can span across region boundaries
    gl.viewport(0, 0, bufW, bufH)
    gl.disable(gl.SCISSOR_TEST)

    // Build absolute region table from all blocks
    const regionTableAbsolute = blocks.map(b => ({
      startBp: b.bpRangeX[0],
      endBp: b.bpRangeX[1],
      startPx: b.screenStartPx,
      endPx: b.screenEndPx,
    }))

    // Sashimi arcs are now rendered as SVG overlay (SashimiArcsOverlay.tsx)

    // Regular arcs (in arcs area)
    const arcsHeight = state.showArcs && state.arcsHeight ? state.arcsHeight : 0
    const covH = state.showCoverage ? state.coverageHeight : 0
    if (arcsHeight > 0) {
      const covHPx = Math.round(covH * dpr)
      const effectiveArcsHPx = Math.min(
        Math.round(arcsHeight * dpr),
        Math.max(0, bufH - covHPx),
      )
      if (effectiveArcsHPx > 0) {
        const arcsY = bufH - covHPx - effectiveArcsHPx
        gl.viewport(0, arcsY, bufW, effectiveArcsHPx)

        for (const [, buffers] of this.buffersMap) {
          if (!buffers.arcVAO || buffers.arcCount === 0) {
            continue
          }
          this.buffers = buffers
          const table = regionTableAbsolute.map(r => ({
            startBpOffset: r.startBp - buffers.regionStart,
            endBpOffset: r.endBp - buffers.regionStart,
            startPx: r.startPx,
            endPx: r.endPx,
          }))
          renderArcs(
            this,
            {
              ...state,
              showCoverage: false,
              coverageHeight: 0,
              canvasHeight: effectiveArcsHPx / dpr,
            },
            table,
          )
        }
      }
    }

    gl.viewport(0, 0, bufW, bufH)
    this.buffers = null
  }

  private deleteBuffersVAOs(buffers: GPUBuffers) {
    const gl = this.gl
    const vaos = [
      buffers.readVAO,
      buffers.coverageVAO,
      buffers.snpCoverageVAO,
      buffers.noncovHistogramVAO,
      buffers.indicatorVAO,
      buffers.gapVAO,
      buffers.mismatchVAO,
      buffers.insertionVAO,
      buffers.softclipVAO,
      buffers.softclipBaseVAO,
      buffers.hardclipVAO,
      buffers.modificationVAO,
      buffers.modCoverageVAO,
      buffers.arcVAO,
      buffers.arcLineVAO,
      buffers.connectingLineVAO,
      buffers.sashimiVAO,
    ]
    for (const vao of vaos) {
      if (vao) {
        gl.deleteVertexArray(vao)
      }
    }
  }

  destroy() {
    const gl = this.gl

    // Clean up per-refName map entries
    for (const buffers of this.buffersMap.values()) {
      this.deleteBuffersVAOs(buffers)
    }
    this.buffersMap.clear()
    const bufferMaps = [
      this.glBuffersMap,
      this.arcInstanceBuffersMap,
      this.sashimiInstanceBuffersMap,
      this.connectingLineGLBuffersMap,
    ]
    for (const map of bufferMaps) {
      for (const bufs of map.values()) {
        for (const buf of bufs) {
          gl.deleteBuffer(buf)
        }
      }
      map.clear()
    }

    // Clean up legacy single-entry state
    for (const buf of this.glBuffers) {
      gl.deleteBuffer(buf)
    }
    this.glBuffers = []
    if (this.buffers) {
      this.deleteBuffersVAOs(this.buffers)
    }
    if (this.lineVAO) {
      gl.deleteVertexArray(this.lineVAO)
    }
    if (this.lineBuffer) {
      gl.deleteBuffer(this.lineBuffer)
    }
    gl.deleteProgram(this.readProgram)
    gl.deleteProgram(this.coverageProgram)
    gl.deleteProgram(this.snpCoverageProgram)
    gl.deleteProgram(this.noncovHistogramProgram)
    gl.deleteProgram(this.indicatorProgram)
    gl.deleteProgram(this.lineProgram)
    gl.deleteProgram(this.gapProgram)
    gl.deleteProgram(this.mismatchProgram)
    gl.deleteProgram(this.insertionProgram)
    gl.deleteProgram(this.softclipProgram)
    gl.deleteProgram(this.hardclipProgram)
    gl.deleteProgram(this.modificationProgram)
    gl.deleteProgram(this.modCoverageProgram)
    // Arcs cleanup
    for (const buf of this.arcInstanceBuffers) {
      gl.deleteBuffer(buf)
    }
    if (this.arcTemplateBuffer) {
      gl.deleteBuffer(this.arcTemplateBuffer)
    }
    if (this.arcProgram) {
      gl.deleteProgram(this.arcProgram)
    }
    if (this.arcLineProgram) {
      gl.deleteProgram(this.arcLineProgram)
    }
    // Sashimi cleanup
    for (const buf of this.sashimiInstanceBuffers) {
      gl.deleteBuffer(buf)
    }
    if (this.sashimiProgram) {
      gl.deleteProgram(this.sashimiProgram)
    }
    // Connecting line cleanup
    for (const buf of this.connectingLineGLBuffers) {
      gl.deleteBuffer(buf)
    }
    if (this.connectingLineProgram) {
      gl.deleteProgram(this.connectingLineProgram)
    }
  }
}
