/**
 * WebGL Renderer for alignments display
 *
 * Handles pileup, arcs, and cloud rendering modes with shared coverage.
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
  ARC_CURVE_SEGMENTS,
  ARC_FRAGMENT_SHADER,
  ARC_LINE_FRAGMENT_SHADER,
  ARC_LINE_VERTEX_SHADER,
  ARC_VERTEX_SHADER,
  CLOUD_FRAGMENT_SHADER,
  CLOUD_VERTEX_SHADER,
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
  arcColorPalette,
  arcLineColorPalette,
  defaultColorPalette,
  sashimiColorPalette,
  splitPositionWithFrac,
} from './shaders/index.ts'

import type { ColorPalette } from './shaders/index.ts'

export type { ColorPalette, RGBColor } from './shaders/index.ts'

export interface RenderState {
  bpRangeX: [number, number] // absolute genomic positions
  rangeY: [number, number]
  colorScheme: number
  featureHeight: number
  featureSpacing: number
  showCoverage: boolean
  coverageHeight: number
  coverageYOffset: number // padding at top/bottom of coverage area for scalebar labels
  showMismatches: boolean
  showInterbaseCounts: boolean
  showInterbaseIndicators: boolean
  showModifications: boolean
  // Canvas dimensions - passed in to avoid forced layout from reading clientWidth/clientHeight
  canvasWidth: number
  canvasHeight: number
  // Feature highlighting (-1 means no highlight)
  highlightedFeatureIndex: number
  // Selected feature for outline (-1 means no selection)
  selectedFeatureIndex: number
  // Optional color palette - uses defaultColorPalette if not provided
  colors?: Partial<ColorPalette>
  // Rendering mode - 'pileup' (default), 'arcs', or 'cloud'
  renderingMode?: 'pileup' | 'arcs' | 'cloud'
  // Arcs-specific
  arcLineWidth?: number
  // Cloud-specific
  cloudColorScheme?: number
  // Sashimi arcs (splice junctions overlaid on coverage)
  showSashimiArcs?: boolean
}

interface GPUBuffers {
  // Reference point for all position offsets
  regionStart: number
  readVAO: WebGLVertexArrayObject
  readCount: number
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
  // Cloud mode
  cloudVAO: WebGLVertexArrayObject | null
  cloudCount: number
  // Sashimi arcs (splice junctions)
  sashimiVAO: WebGLVertexArrayObject | null
  sashimiCount: number
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement

  private readProgram: WebGLProgram
  private coverageProgram: WebGLProgram
  private snpCoverageProgram: WebGLProgram
  private noncovHistogramProgram: WebGLProgram
  private indicatorProgram: WebGLProgram
  private lineProgram: WebGLProgram
  private gapProgram: WebGLProgram
  private mismatchProgram: WebGLProgram
  private insertionProgram: WebGLProgram
  private softclipProgram: WebGLProgram
  private hardclipProgram: WebGLProgram
  private modificationProgram: WebGLProgram
  private modCoverageProgram: WebGLProgram

  private buffers: GPUBuffers | null = null
  private glBuffers: WebGLBuffer[] = []
  private buffersMap = new Map<number, GPUBuffers>()
  private glBuffersMap = new Map<number, WebGLBuffer[]>()
  private arcInstanceBuffersMap = new Map<number, WebGLBuffer[]>()
  private cloudGLBuffersMap = new Map<number, WebGLBuffer[]>()
  private lineVAO: WebGLVertexArrayObject | null = null
  private lineBuffer: WebGLBuffer | null = null

  private readUniforms: Record<string, WebGLUniformLocation | null> = {}
  private coverageUniforms: Record<string, WebGLUniformLocation | null> = {}
  private snpCoverageUniforms: Record<string, WebGLUniformLocation | null> = {}
  private noncovHistogramUniforms: Record<string, WebGLUniformLocation | null> =
    {}
  private indicatorUniforms: Record<string, WebGLUniformLocation | null> = {}
  private lineUniforms: Record<string, WebGLUniformLocation | null> = {}
  private gapUniforms: Record<string, WebGLUniformLocation | null> = {}
  private mismatchUniforms: Record<string, WebGLUniformLocation | null> = {}
  private insertionUniforms: Record<string, WebGLUniformLocation | null> = {}
  private softclipUniforms: Record<string, WebGLUniformLocation | null> = {}
  private hardclipUniforms: Record<string, WebGLUniformLocation | null> = {}
  private modificationUniforms: Record<string, WebGLUniformLocation | null> = {}
  private modCoverageUniforms: Record<string, WebGLUniformLocation | null> = {}

  // Arcs mode
  private arcProgram: WebGLProgram | null = null
  private arcLineProgram: WebGLProgram | null = null
  private arcTemplateBuffer: WebGLBuffer | null = null
  private arcInstanceBuffers: WebGLBuffer[] = []
  private arcUniforms: Record<string, WebGLUniformLocation | null> = {}
  private arcLineUniforms: Record<string, WebGLUniformLocation | null> = {}

  // Sashimi mode
  private sashimiProgram: WebGLProgram | null = null
  private sashimiInstanceBuffers: WebGLBuffer[] = []
  private sashimiInstanceBuffersMap = new Map<number, WebGLBuffer[]>()
  private sashimiUniforms: Record<string, WebGLUniformLocation | null> = {}

  // Cloud mode
  private cloudProgram: WebGLProgram | null = null
  private cloudGLBuffers: WebGLBuffer[] = []
  private cloudUniforms: Record<string, WebGLUniformLocation | null> = {}

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })

    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.readProgram = this.createProgram(
      READ_VERTEX_SHADER,
      READ_FRAGMENT_SHADER,
    )

    this.coverageProgram = this.createProgram(
      COVERAGE_VERTEX_SHADER,
      COVERAGE_FRAGMENT_SHADER,
    )

    this.snpCoverageProgram = this.createProgram(
      SNP_COVERAGE_VERTEX_SHADER,
      SNP_COVERAGE_FRAGMENT_SHADER,
    )

    this.noncovHistogramProgram = this.createProgram(
      NONCOV_HISTOGRAM_VERTEX_SHADER,
      NONCOV_HISTOGRAM_FRAGMENT_SHADER,
    )

    this.indicatorProgram = this.createProgram(
      INDICATOR_VERTEX_SHADER,
      INDICATOR_FRAGMENT_SHADER,
    )

    this.lineProgram = this.createProgram(
      LINE_VERTEX_SHADER,
      LINE_FRAGMENT_SHADER,
    )
    this.gapProgram = this.createProgram(GAP_VERTEX_SHADER, GAP_FRAGMENT_SHADER)
    this.mismatchProgram = this.createProgram(
      MISMATCH_VERTEX_SHADER,
      MISMATCH_FRAGMENT_SHADER,
    )
    this.insertionProgram = this.createProgram(
      INSERTION_VERTEX_SHADER,
      INSERTION_FRAGMENT_SHADER,
    )
    this.softclipProgram = this.createProgram(
      SOFTCLIP_VERTEX_SHADER,
      SOFTCLIP_FRAGMENT_SHADER,
    )
    this.hardclipProgram = this.createProgram(
      HARDCLIP_VERTEX_SHADER,
      HARDCLIP_FRAGMENT_SHADER,
    )
    this.modificationProgram = this.createProgram(
      MODIFICATION_VERTEX_SHADER,
      MODIFICATION_FRAGMENT_SHADER,
    )
    this.modCoverageProgram = this.createProgram(
      MOD_COVERAGE_VERTEX_SHADER,
      MOD_COVERAGE_FRAGMENT_SHADER,
    )

    this.cacheUniforms(this.lineProgram, this.lineUniforms, ['u_color'])

    // Create line VAO and buffer for separator
    this.lineVAO = gl.createVertexArray()
    this.lineBuffer = gl.createBuffer()
    gl.bindVertexArray(this.lineVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
    const linePosLoc = gl.getAttribLocation(this.lineProgram, 'a_position')
    gl.enableVertexAttribArray(linePosLoc)
    gl.vertexAttribPointer(linePosLoc, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    this.cacheUniforms(this.readProgram, this.readUniforms, [
      'u_bpRangeX',
      'u_regionStart',
      'u_rangeY',
      'u_colorScheme',
      'u_featureHeight',
      'u_featureSpacing',
      'u_coverageOffset',
      'u_canvasHeight',
      'u_highlightedIndex',
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
    ])

    this.cacheUniforms(this.coverageProgram, this.coverageUniforms, [
      'u_visibleRange',
      'u_coverageHeight',
      'u_coverageYOffset',
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

    this.cacheUniforms(this.snpCoverageProgram, this.snpCoverageUniforms, [
      'u_visibleRange',
      'u_coverageHeight',
      'u_coverageYOffset',
      'u_canvasHeight',
      'u_canvasWidth',
      ...baseColorUniforms,
    ])

    this.cacheUniforms(
      this.noncovHistogramProgram,
      this.noncovHistogramUniforms,
      [
        'u_visibleRange',
        'u_noncovHeight',
        'u_canvasHeight',
        'u_canvasWidth',
        ...indelColorUniforms,
      ],
    )

    this.cacheUniforms(this.indicatorProgram, this.indicatorUniforms, [
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
    ]
    const cigarUniformsWithWidth = [...cigarUniforms, 'u_canvasWidth']
    this.cacheUniforms(this.gapProgram, this.gapUniforms, [
      ...cigarUniforms,
      'u_colorDeletion',
      'u_colorSkip',
    ])
    this.cacheUniforms(this.mismatchProgram, this.mismatchUniforms, [
      ...cigarUniformsWithWidth,
      ...baseColorUniforms,
    ])
    this.cacheUniforms(this.insertionProgram, this.insertionUniforms, [
      ...cigarUniformsWithWidth,
      'u_colorInsertion',
    ])
    this.cacheUniforms(this.softclipProgram, this.softclipUniforms, [
      ...cigarUniformsWithWidth,
      'u_colorSoftclip',
    ])
    this.cacheUniforms(this.hardclipProgram, this.hardclipUniforms, [
      ...cigarUniformsWithWidth,
      'u_colorHardclip',
    ])
    this.cacheUniforms(this.modificationProgram, this.modificationUniforms, [
      ...cigarUniformsWithWidth,
    ])
    this.cacheUniforms(this.modCoverageProgram, this.modCoverageUniforms, [
      'u_visibleRange',
      'u_coverageHeight',
      'u_coverageYOffset',
      'u_canvasHeight',
      'u_canvasWidth',
    ])

    // Arcs programs
    this.arcProgram = this.createProgram(ARC_VERTEX_SHADER, ARC_FRAGMENT_SHADER)
    this.arcLineProgram = this.createProgram(
      ARC_LINE_VERTEX_SHADER,
      ARC_LINE_FRAGMENT_SHADER,
    )

    this.cacheUniforms(this.arcProgram, this.arcUniforms, [
      'u_bpStartOffset',
      'u_bpRegionLength',
      'u_canvasWidth',
      'u_canvasHeight',
      'u_coverageOffset',
      'u_lineWidthPx',
      'u_gradientHue',
      'u_blockStartPx',
      'u_blockWidth',
    ])
    for (let i = 0; i < NUM_ARC_COLORS; i++) {
      this.arcUniforms[`u_arcColors[${i}]`] = gl.getUniformLocation(
        this.arcProgram,
        `u_arcColors[${i}]`,
      )
    }

    this.cacheUniforms(this.arcLineProgram, this.arcLineUniforms, [
      'u_bpRangeX',
      'u_regionStart',
      'u_canvasHeight',
      'u_coverageOffset',
      'u_blockStartPx',
      'u_blockWidth',
      'u_canvasWidth',
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
    this.sashimiProgram = this.createProgram(
      SASHIMI_ARC_VERTEX_SHADER,
      SASHIMI_ARC_FRAGMENT_SHADER,
    )
    this.cacheUniforms(this.sashimiProgram, this.sashimiUniforms, [
      'u_bpStartOffset',
      'u_bpRegionLength',
      'u_canvasWidth',
      'u_canvasHeight',
      'u_coverageOffset',
      'u_coverageHeight',
      'u_blockStartPx',
      'u_blockWidth',
    ])
    for (let i = 0; i < NUM_SASHIMI_COLORS; i++) {
      this.sashimiUniforms[`u_sashimiColors[${i}]`] = gl.getUniformLocation(
        this.sashimiProgram,
        `u_sashimiColors[${i}]`,
      )
    }

    // Cloud program
    this.cloudProgram = this.createProgram(
      CLOUD_VERTEX_SHADER,
      CLOUD_FRAGMENT_SHADER,
    )
    this.cacheUniforms(this.cloudProgram, this.cloudUniforms, [
      'u_bpRangeX',
      'u_regionStart',
      'u_featureHeight',
      'u_canvasHeight',
      'u_coverageOffset',
      'u_colorScheme',
    ])

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(`Shader compile error: ${info}`)
    }
    return shader
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl
    const vs = this.createShader(gl.VERTEX_SHADER, vsSource)
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource)
    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.detachShader(program, vs)
    gl.detachShader(program, fs)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program)
      gl.deleteProgram(program)
      throw new Error(`Program link error: ${info}`)
    }
    return program
  }

  private cacheUniforms(
    program: WebGLProgram,
    cache: Record<string, WebGLUniformLocation | null>,
    names: string[],
  ) {
    for (const name of names) {
      cache[name] = this.gl.getUniformLocation(program, name)
    }
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
    readInsertSizes: Float32Array
    readPairOrientations: Uint8Array
    readStrands: Int8Array
    readTagColors: Uint8Array // RGB per read (3 bytes each), for tag coloring
    numReads: number
    maxY: number
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
    // Clean up old VAOs
    if (oldBuffers) {
      gl.deleteVertexArray(oldBuffers.readVAO)
      if (oldBuffers.coverageVAO) {
        gl.deleteVertexArray(oldBuffers.coverageVAO)
      }
      if (oldBuffers.snpCoverageVAO) {
        gl.deleteVertexArray(oldBuffers.snpCoverageVAO)
      }
      if (oldBuffers.noncovHistogramVAO) {
        gl.deleteVertexArray(oldBuffers.noncovHistogramVAO)
      }
      if (oldBuffers.indicatorVAO) {
        gl.deleteVertexArray(oldBuffers.indicatorVAO)
      }
      if (oldBuffers.gapVAO) {
        gl.deleteVertexArray(oldBuffers.gapVAO)
      }
      if (oldBuffers.mismatchVAO) {
        gl.deleteVertexArray(oldBuffers.mismatchVAO)
      }
      if (oldBuffers.insertionVAO) {
        gl.deleteVertexArray(oldBuffers.insertionVAO)
      }
      if (oldBuffers.softclipVAO) {
        gl.deleteVertexArray(oldBuffers.softclipVAO)
      }
      if (oldBuffers.hardclipVAO) {
        gl.deleteVertexArray(oldBuffers.hardclipVAO)
      }
      if (oldBuffers.modificationVAO) {
        gl.deleteVertexArray(oldBuffers.modificationVAO)
      }
      if (oldBuffers.modCoverageVAO) {
        gl.deleteVertexArray(oldBuffers.modCoverageVAO)
      }
      if (oldBuffers.arcVAO) {
        gl.deleteVertexArray(oldBuffers.arcVAO)
      }
      if (oldBuffers.arcLineVAO) {
        gl.deleteVertexArray(oldBuffers.arcLineVAO)
      }
      if (oldBuffers.cloudVAO) {
        gl.deleteVertexArray(oldBuffers.cloudVAO)
      }
    }
    // Clean up arc instance buffers
    for (const buf of this.arcInstanceBuffers) {
      gl.deleteBuffer(buf)
    }
    this.arcInstanceBuffers = []
    // Clean up cloud buffers
    for (const buf of this.cloudGLBuffers) {
      gl.deleteBuffer(buf)
    }
    this.cloudGLBuffers = []

    if (data.numReads === 0) {
      // Create a minimal buffers object so arcs/cloud modes can attach their data
      const emptyVAO = gl.createVertexArray()
      gl.bindVertexArray(emptyVAO)
      gl.bindVertexArray(null)
      this.buffers = {
        regionStart: data.regionStart,
        readVAO: emptyVAO,
        readCount: 0,
        readPositions: data.readPositions,
        readYs: data.readYs,
        readStrands: data.readStrands,
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
        cloudVAO: null,
        cloudCount: 0,
      }
      return
    }

    // Read VAO - use integer positions for high-precision rendering
    const readVAO = gl.createVertexArray()
    gl.bindVertexArray(readVAO)
    // Upload positions as unsigned integers for high-precision (12-bit split in shader)
    this.uploadUintBuffer(this.readProgram, 'a_position', data.readPositions, 2)
    this.uploadBuffer(this.readProgram, 'a_y', new Float32Array(data.readYs), 1)
    this.uploadBuffer(
      this.readProgram,
      'a_flags',
      new Float32Array(data.readFlags),
      1,
    )
    this.uploadBuffer(
      this.readProgram,
      'a_mapq',
      new Float32Array(data.readMapqs),
      1,
    )
    this.uploadBuffer(this.readProgram, 'a_insertSize', data.readInsertSizes, 1)
    this.uploadBuffer(
      this.readProgram,
      'a_pairOrientation',
      new Float32Array(data.readPairOrientations),
      1,
    )
    this.uploadBuffer(
      this.readProgram,
      'a_strand',
      new Float32Array(data.readStrands),
      1,
    )
    // Only upload tag colors if data is available; otherwise set a constant
    // attribute value to avoid "attribs only supply 0" WebGL warning
    if (data.readTagColors.length > 0) {
      this.uploadNormalizedByteBuffer(
        this.readProgram,
        'a_tagColor',
        data.readTagColors,
        3,
      )
    } else {
      const loc = gl.getAttribLocation(this.readProgram, 'a_tagColor')
      if (loc >= 0) {
        gl.disableVertexAttribArray(loc)
        gl.vertexAttrib3f(loc, 0, 0, 0)
      }
    }
    gl.bindVertexArray(null)

    this.buffers = {
      regionStart: data.regionStart,
      readVAO,
      readCount: data.numReads,
      readPositions: data.readPositions,
      readYs: data.readYs,
      readStrands: data.readStrands,
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
      cloudVAO: null,
      cloudCount: 0,
    }
  }

  /**
   * Upload CIGAR data from pre-computed typed arrays (from RPC worker)
   * Accepts optimized integer types and converts to float for GPU
   */
  uploadCigarFromTypedArrays(data: {
    gapPositions: Uint32Array
    gapYs: Uint16Array
    gapTypes: Uint8Array
    numGaps: number
    mismatchPositions: Uint32Array
    mismatchYs: Uint16Array
    mismatchBases: Uint8Array
    numMismatches: number
    insertionPositions: Uint32Array
    insertionYs: Uint16Array
    insertionLengths: Uint16Array
    numInsertions: number
    softclipPositions: Uint32Array
    softclipYs: Uint16Array
    softclipLengths: Uint16Array
    numSoftclips: number
    hardclipPositions: Uint32Array
    hardclipYs: Uint16Array
    hardclipLengths: Uint16Array
    numHardclips: number
  }) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    // Clean up old CIGAR VAOs
    if (this.buffers.gapVAO) {
      gl.deleteVertexArray(this.buffers.gapVAO)
      this.buffers.gapVAO = null
    }
    if (this.buffers.mismatchVAO) {
      gl.deleteVertexArray(this.buffers.mismatchVAO)
      this.buffers.mismatchVAO = null
    }
    if (this.buffers.insertionVAO) {
      gl.deleteVertexArray(this.buffers.insertionVAO)
      this.buffers.insertionVAO = null
    }
    if (this.buffers.softclipVAO) {
      gl.deleteVertexArray(this.buffers.softclipVAO)
      this.buffers.softclipVAO = null
    }
    if (this.buffers.hardclipVAO) {
      gl.deleteVertexArray(this.buffers.hardclipVAO)
      this.buffers.hardclipVAO = null
    }

    // Upload gaps - use integer buffers directly (no Float32 conversion)
    if (data.numGaps > 0) {
      const gapVAO = gl.createVertexArray()
      gl.bindVertexArray(gapVAO)
      this.uploadUintBuffer(this.gapProgram, 'a_position', data.gapPositions, 2)
      this.uploadUint16Buffer(this.gapProgram, 'a_y', data.gapYs, 1)
      this.uploadUint8Buffer(this.gapProgram, 'a_type', data.gapTypes, 1)
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
      gl.bindVertexArray(null)

      this.buffers.mismatchVAO = mismatchVAO
      this.buffers.mismatchCount = data.numMismatches
    } else {
      this.buffers.mismatchCount = 0
    }

    // Upload insertions - use integer buffers directly
    if (data.numInsertions > 0) {
      const insertionVAO = gl.createVertexArray()
      gl.bindVertexArray(insertionVAO)
      this.uploadUintBuffer(
        this.insertionProgram,
        'a_position',
        data.insertionPositions,
        1,
      )
      this.uploadUint16Buffer(this.insertionProgram, 'a_y', data.insertionYs, 1)
      this.uploadUint16Buffer(
        this.insertionProgram,
        'a_length',
        data.insertionLengths,
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.insertionVAO = insertionVAO
      this.buffers.insertionCount = data.numInsertions
    } else {
      this.buffers.insertionCount = 0
    }

    // Upload soft clips - use integer buffers directly
    if (data.numSoftclips > 0) {
      const softclipVAO = gl.createVertexArray()
      gl.bindVertexArray(softclipVAO)
      this.uploadUintBuffer(
        this.softclipProgram,
        'a_position',
        data.softclipPositions,
        1,
      )
      this.uploadUint16Buffer(this.softclipProgram, 'a_y', data.softclipYs, 1)
      this.uploadUint16Buffer(
        this.softclipProgram,
        'a_length',
        data.softclipLengths,
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.softclipVAO = softclipVAO
      this.buffers.softclipCount = data.numSoftclips
    } else {
      this.buffers.softclipCount = 0
    }

    // Upload hard clips - use integer buffers directly
    if (data.numHardclips > 0) {
      const hardclipVAO = gl.createVertexArray()
      gl.bindVertexArray(hardclipVAO)
      this.uploadUintBuffer(
        this.hardclipProgram,
        'a_position',
        data.hardclipPositions,
        1,
      )
      this.uploadUint16Buffer(this.hardclipProgram, 'a_y', data.hardclipYs, 1)
      this.uploadUint16Buffer(
        this.hardclipProgram,
        'a_length',
        data.hardclipLengths,
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.hardclipVAO = hardclipVAO
      this.buffers.hardclipCount = data.numHardclips
    } else {
      this.buffers.hardclipCount = 0
    }
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
    coverageBinSize: number
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
        positions[i] = data.coverageStartOffset + i * data.coverageBinSize
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
      this.buffers.binSize = data.coverageBinSize
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

  /**
   * Ensure a buffers object exists (needed for arcs/cloud modes that don't have pileup data)
   */
  ensureBuffers(regionStart: number) {
    if (this.buffers) {
      return
    }
    const gl = this.gl
    const emptyVAO = gl.createVertexArray()
    gl.bindVertexArray(emptyVAO)
    gl.bindVertexArray(null)
    this.buffers = {
      regionStart,
      readVAO: emptyVAO,
      readCount: 0,
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
      cloudVAO: null,
      cloudCount: 0,
      sashimiVAO: null,
      sashimiCount: 0,
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
    data: Parameters<WebGLRenderer['uploadSashimiFromTypedArrays']>[0],
  ) {
    this.activateRegion(regionNumber)
    this.uploadSashimiFromTypedArrays(data)
    this.deactivateRegion(regionNumber)
  }

  /**
   * Upload cloud data from pre-computed typed arrays (from RPC worker)
   */
  uploadCloudFromTypedArrays(data: {
    regionStart: number
    chainPositions: Uint32Array
    chainYs: Float32Array
    chainFlags: Uint16Array
    chainColorTypes: Uint8Array
    numChains: number
  }) {
    const gl = this.gl
    this.ensureBuffers(data.regionStart)

    if (!this.buffers || !this.cloudProgram) {
      return
    }

    // Clean up old cloud VAO
    if (this.buffers.cloudVAO) {
      gl.deleteVertexArray(this.buffers.cloudVAO)
      this.buffers.cloudVAO = null
    }
    for (const buf of this.cloudGLBuffers) {
      gl.deleteBuffer(buf)
    }
    this.cloudGLBuffers = []

    if (data.numChains === 0) {
      this.buffers.cloudCount = 0
      return
    }

    const cloudVAO = gl.createVertexArray()
    gl.bindVertexArray(cloudVAO)

    this.uploadCloudBuffer(
      this.cloudProgram,
      'a_position',
      data.chainPositions,
      2,
      true,
    )
    this.uploadCloudBuffer(this.cloudProgram, 'a_y', data.chainYs, 1, false)
    this.uploadCloudBuffer(
      this.cloudProgram,
      'a_flags',
      new Float32Array(data.chainFlags),
      1,
      false,
    )
    this.uploadCloudBuffer(
      this.cloudProgram,
      'a_colorType',
      new Float32Array(data.chainColorTypes),
      1,
      false,
    )

    gl.bindVertexArray(null)
    this.buffers.cloudVAO = cloudVAO
    this.buffers.cloudCount = data.numChains
  }

  private uploadCloudBuffer(
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
    this.cloudGLBuffers.push(buffer)
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
    for (const buf of this.cloudGLBuffers) {
      gl.deleteBuffer(buf)
    }
    this.cloudGLBuffers = []
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
    this.cloudGLBuffers = this.cloudGLBuffersMap.get(regionNumber) ?? []
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
    this.cloudGLBuffersMap.set(regionNumber, this.cloudGLBuffers)
    // Reset to null so stale pointers don't linger
    this.buffers = null
    this.glBuffers = []
    this.arcInstanceBuffers = []
    this.sashimiInstanceBuffers = []
    this.cloudGLBuffers = []
  }

  /**
   * Upload read data for a specific region
   */
  uploadFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadFromTypedArrays']>[0],
  ) {
    this.activateRegion(regionNumber)
    this.uploadFromTypedArrays(data)
    this.deactivateRegion(regionNumber)
  }

  /**
   * Upload CIGAR data for a specific region
   */
  uploadCigarFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadCigarFromTypedArrays']>[0],
  ) {
    this.activateRegion(regionNumber)
    this.uploadCigarFromTypedArrays(data)
    this.deactivateRegion(regionNumber)
  }

  /**
   * Upload coverage data for a specific region
   */
  uploadCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadCoverageFromTypedArrays']>[0],
  ) {
    this.activateRegion(regionNumber)
    this.uploadCoverageFromTypedArrays(data)
    this.deactivateRegion(regionNumber)
  }

  /**
   * Upload modification data for a specific region
   */
  uploadModificationsFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadModificationsFromTypedArrays']>[0],
  ) {
    this.activateRegion(regionNumber)
    this.uploadModificationsFromTypedArrays(data)
    this.deactivateRegion(regionNumber)
  }

  /**
   * Upload modification coverage data for a specific region
   */
  uploadModCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadModCoverageFromTypedArrays']>[0],
  ) {
    this.activateRegion(regionNumber)
    this.uploadModCoverageFromTypedArrays(data)
    this.deactivateRegion(regionNumber)
  }

  /**
   * Upload arcs data for a specific region
   */
  uploadArcsFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadArcsFromTypedArrays']>[0],
  ) {
    this.activateRegion(regionNumber)
    this.uploadArcsFromTypedArrays(data)
    this.deactivateRegion(regionNumber)
  }

  /**
   * Upload cloud data for a specific region
   */
  uploadCloudFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadCloudFromTypedArrays']>[0],
  ) {
    this.activateRegion(regionNumber)
    this.uploadCloudFromTypedArrays(data)
    this.deactivateRegion(regionNumber)
  }

  /**
   * Render multiple blocks with scissor rects, each from a different refName's GPU buffers.
   */
  renderBlocks(
    blocks: {
      regionNumber: number
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    }[],
    state: RenderState,
  ) {
    const gl = this.gl
    const canvas = this.canvas
    const { canvasWidth, canvasHeight } = state

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const colors: ColorPalette = { ...defaultColorPalette, ...state.colors }
    const mode = state.renderingMode ?? 'pileup'

    for (const block of blocks) {
      const buffers = this.buffersMap.get(block.regionNumber)
      if (!buffers) {
        continue
      }

      // Set this.buffers so private render methods can use it
      this.buffers = buffers

      const regionStart = buffers.regionStart

      // Scissor to this block's screen region, clipped to viewport
      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }
      gl.enable(gl.SCISSOR_TEST)
      gl.scissor(scissorX, 0, scissorW, canvasHeight)

      // Compute viewport-clipped domain: the genomic range corresponding to
      // the visible portion of this block. Needed for shaders that map domain
      // to [-1,1] clip space (pileup, coverage, cloud) since the per-block
      // gl.viewport maps [-1,1] to the visible screen region.
      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const bpPerPx =
        fullBlockWidth > 0
          ? (block.bpRangeX[1] - block.bpRangeX[0]) / fullBlockWidth
          : 1
      const clippedBpStart =
        block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedBpEnd =
        block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx
      const clippedBpOffset: [number, number] = [
        clippedBpStart - regionStart,
        clippedBpEnd - regionStart,
      ]

      // Per-block viewport: maps shader's [-1,1] clip space to this block's
      // screen region. Pass blockWidth as canvasWidth so pixel calculations
      // (chevron width, min bar width) are correct for the block's scale.
      gl.viewport(scissorX, 0, scissorW, canvasHeight)
      const blockState: RenderState = {
        ...state,
        bpRangeX: [clippedBpStart, clippedBpEnd] as [number, number],
        canvasWidth: scissorW,
      }

      // Draw coverage for this block (always uses viewport-clipped domain)
      this.renderCoverage(blockState, clippedBpOffset, colors)

      // Draw sashimi arcs overlaid on coverage (uses full-canvas viewport like arcs)
      if (state.showSashimiArcs && state.showCoverage) {
        gl.viewport(0, 0, canvasWidth, canvasHeight)
        this.renderSashimiArcs(
          { ...state, bpRangeX: block.bpRangeX },
          block.screenStartPx,
          fullBlockWidth,
        )
        gl.viewport(scissorX, 0, scissorW, canvasHeight)
      }

      if (mode === 'arcs') {
        // Arcs use full-canvas viewport with global positioning uniforms.
        // Restore full viewport so arc positions are globally stable.
        gl.viewport(0, 0, canvasWidth, canvasHeight)
        this.renderArcs(
          { ...state, bpRangeX: block.bpRangeX },
          block.screenStartPx,
          fullBlockWidth,
        )
      } else if (mode === 'cloud') {
        this.renderCloud(blockState)
      } else {
        this.renderPileup(blockState, clippedBpOffset, colors, scissorX)
      }
    }

    // Restore full viewport and disable scissor
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.disable(gl.SCISSOR_TEST)
    this.buffers = null
  }

  render(state: RenderState) {
    const gl = this.gl
    const canvas = this.canvas

    // Use passed-in dimensions to avoid forced layout from reading clientWidth/clientHeight
    const { canvasWidth, canvasHeight } = state

    // Handle resize - only update canvas buffer size if dimensions changed
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.buffers) {
      return
    }

    // Common preamble for all rendering modes
    const regionStart = this.buffers.regionStart
    const domainOffset: [number, number] = [
      state.bpRangeX[0] - regionStart,
      state.bpRangeX[1] - regionStart,
    ]
    const colors: ColorPalette = { ...defaultColorPalette, ...state.colors }

    // Draw coverage first (at top) — shared across all modes
    this.renderCoverage(state, domainOffset, colors)

    // Draw sashimi arcs overlaid on coverage
    if (state.showSashimiArcs && state.showCoverage) {
      this.renderSashimiArcs(state)
    }

    const mode = state.renderingMode ?? 'pileup'

    // Dispatch to mode-specific rendering
    if (mode === 'arcs') {
      this.renderArcs(state)
    } else if (mode === 'cloud') {
      this.renderCloud(state)
    } else {
      this.renderPileup(state, domainOffset, colors)
    }
  }

  private renderPileup(
    state: RenderState,
    domainOffset: [number, number],
    colors: ColorPalette,
    scissorX = 0,
  ) {
    const gl = this.gl
    if (!this.buffers || this.buffers.readCount === 0) {
      return
    }

    const { canvasWidth, canvasHeight } = state
    const regionStart = this.buffers.regionStart

    // Compute high-precision split domain for reads (12-bit split approach).
    // Uses splitPositionWithFrac to preserve fractional scroll position - without this,
    // reads would "stick" at integer bp positions and snap when crossing boundaries.
    const [bpStartHi, bpStartLo] = splitPositionWithFrac(
      state.bpRangeX[0],
    )
    const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

    // Draw reads
    const coverageOffset = state.showCoverage ? state.coverageHeight : 0

    // Scissor clips pileup to area below coverage, within the block's X range.
    // gl.scissor uses window coordinates, so we must use the block's scissorX.
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(scissorX, 0, canvasWidth, canvasHeight - coverageOffset)

    gl.useProgram(this.readProgram)
    // Use high-precision split domain for reads (vec3: hi, lo, extent)
    gl.uniform3f(
      this.readUniforms.u_bpRangeX!,
      bpStartHi,
      bpStartLo,
      regionLengthBp,
    )
    // Pass regionStart so shader can convert offsets to absolute positions (must be integer)
    gl.uniform1ui(this.readUniforms.u_regionStart!, Math.floor(regionStart))
    gl.uniform2f(this.readUniforms.u_rangeY!, state.rangeY[0], state.rangeY[1])
    gl.uniform1i(this.readUniforms.u_colorScheme!, state.colorScheme)
    gl.uniform1f(this.readUniforms.u_featureHeight!, state.featureHeight)
    gl.uniform1f(this.readUniforms.u_featureSpacing!, state.featureSpacing)
    gl.uniform1f(this.readUniforms.u_coverageOffset!, coverageOffset)
    gl.uniform1f(this.readUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(this.readUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform1i(
      this.readUniforms.u_highlightedIndex!,
      state.highlightedFeatureIndex,
    )

    // Set color uniforms for read shapes
    gl.uniform3f(this.readUniforms.u_colorFwdStrand!, ...colors.colorFwdStrand)
    gl.uniform3f(this.readUniforms.u_colorRevStrand!, ...colors.colorRevStrand)
    gl.uniform3f(this.readUniforms.u_colorNostrand!, ...colors.colorNostrand)
    gl.uniform3f(this.readUniforms.u_colorPairLR!, ...colors.colorPairLR)
    gl.uniform3f(this.readUniforms.u_colorPairRL!, ...colors.colorPairRL)
    gl.uniform3f(this.readUniforms.u_colorPairRR!, ...colors.colorPairRR)
    gl.uniform3f(this.readUniforms.u_colorPairLL!, ...colors.colorPairLL)
    gl.uniform3f(
      this.readUniforms.u_colorModificationFwd!,
      ...colors.colorModificationFwd,
    )
    gl.uniform3f(
      this.readUniforms.u_colorModificationRev!,
      ...colors.colorModificationRev,
    )

    gl.bindVertexArray(this.buffers.readVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 9, this.buffers.readCount)

    // Draw CIGAR features if enabled (suppress when showing modifications overlay)
    if (state.showMismatches && !state.showModifications) {
      // Draw gaps (deletions)
      if (this.buffers.gapVAO && this.buffers.gapCount > 0) {
        gl.useProgram(this.gapProgram)
        gl.uniform2f(
          this.gapUniforms.u_bpRangeX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.gapUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(this.gapUniforms.u_featureHeight!, state.featureHeight)
        gl.uniform1f(this.gapUniforms.u_featureSpacing!, state.featureSpacing)
        gl.uniform1f(this.gapUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.gapUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform3f(
          this.gapUniforms.u_colorDeletion!,
          colors.colorDeletion[0],
          colors.colorDeletion[1],
          colors.colorDeletion[2],
        )
        gl.uniform3f(
          this.gapUniforms.u_colorSkip!,
          colors.colorSkip[0],
          colors.colorSkip[1],
          colors.colorSkip[2],
        )

        gl.bindVertexArray(this.buffers.gapVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.gapCount)
      }

      // Draw mismatches
      if (this.buffers.mismatchVAO && this.buffers.mismatchCount > 0) {
        gl.useProgram(this.mismatchProgram)
        gl.uniform2f(
          this.mismatchUniforms.u_bpRangeX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.mismatchUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(
          this.mismatchUniforms.u_featureHeight!,
          state.featureHeight,
        )
        gl.uniform1f(
          this.mismatchUniforms.u_featureSpacing!,
          state.featureSpacing,
        )
        gl.uniform1f(this.mismatchUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.mismatchUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.mismatchUniforms.u_canvasWidth!, canvasWidth)
        // Base color uniforms from theme
        gl.uniform3f(this.mismatchUniforms.u_colorBaseA!, ...colors.colorBaseA)
        gl.uniform3f(this.mismatchUniforms.u_colorBaseC!, ...colors.colorBaseC)
        gl.uniform3f(this.mismatchUniforms.u_colorBaseG!, ...colors.colorBaseG)
        gl.uniform3f(this.mismatchUniforms.u_colorBaseT!, ...colors.colorBaseT)

        gl.bindVertexArray(this.buffers.mismatchVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.mismatchCount)
      }

      // Draw insertions
      // Each insertion is 3 rectangles (bar + 2 ticks) = 18 vertices
      if (this.buffers.insertionVAO && this.buffers.insertionCount > 0) {
        gl.useProgram(this.insertionProgram)
        gl.uniform2f(
          this.insertionUniforms.u_bpRangeX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.insertionUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(
          this.insertionUniforms.u_featureHeight!,
          state.featureHeight,
        )
        gl.uniform1f(
          this.insertionUniforms.u_featureSpacing!,
          state.featureSpacing,
        )
        gl.uniform1f(this.insertionUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.insertionUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.insertionUniforms.u_canvasWidth!, canvasWidth)
        // Insertion color uniform from theme
        gl.uniform3f(
          this.insertionUniforms.u_colorInsertion!,
          ...colors.colorInsertion,
        )

        gl.bindVertexArray(this.buffers.insertionVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 18, this.buffers.insertionCount)
      }

      // Draw soft clips
      if (this.buffers.softclipVAO && this.buffers.softclipCount > 0) {
        gl.useProgram(this.softclipProgram)
        gl.uniform2f(
          this.softclipUniforms.u_bpRangeX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.softclipUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(
          this.softclipUniforms.u_featureHeight!,
          state.featureHeight,
        )
        gl.uniform1f(
          this.softclipUniforms.u_featureSpacing!,
          state.featureSpacing,
        )
        gl.uniform1f(this.softclipUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.softclipUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.softclipUniforms.u_canvasWidth!, canvasWidth)
        // Softclip color uniform from theme
        gl.uniform3f(
          this.softclipUniforms.u_colorSoftclip!,
          ...colors.colorSoftclip,
        )

        gl.bindVertexArray(this.buffers.softclipVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.softclipCount)
      }

      // Draw hard clips
      if (this.buffers.hardclipVAO && this.buffers.hardclipCount > 0) {
        gl.useProgram(this.hardclipProgram)
        gl.uniform2f(
          this.hardclipUniforms.u_bpRangeX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.hardclipUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(
          this.hardclipUniforms.u_featureHeight!,
          state.featureHeight,
        )
        gl.uniform1f(
          this.hardclipUniforms.u_featureSpacing!,
          state.featureSpacing,
        )
        gl.uniform1f(this.hardclipUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.hardclipUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.hardclipUniforms.u_canvasWidth!, canvasWidth)
        // Hardclip color uniform from theme
        gl.uniform3f(
          this.hardclipUniforms.u_colorHardclip!,
          ...colors.colorHardclip,
        )

        gl.bindVertexArray(this.buffers.hardclipVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.hardclipCount)
      }
    }

    // Draw modifications (on top of reads and mismatches)
    if (
      state.showModifications &&
      this.buffers.modificationVAO &&
      this.buffers.modificationCount > 0
    ) {
      gl.useProgram(this.modificationProgram)
      gl.uniform2f(
        this.modificationUniforms.u_bpRangeX!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform2f(
        this.modificationUniforms.u_rangeY!,
        state.rangeY[0],
        state.rangeY[1],
      )
      gl.uniform1f(
        this.modificationUniforms.u_featureHeight!,
        state.featureHeight,
      )
      gl.uniform1f(
        this.modificationUniforms.u_featureSpacing!,
        state.featureSpacing,
      )
      gl.uniform1f(this.modificationUniforms.u_coverageOffset!, coverageOffset)
      gl.uniform1f(this.modificationUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.modificationUniforms.u_canvasWidth!, canvasWidth)

      gl.bindVertexArray(this.buffers.modificationVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.modificationCount)
    }

    gl.disable(gl.SCISSOR_TEST)

    // Draw selection outline if a feature is selected
    if (
      state.selectedFeatureIndex >= 0 &&
      state.selectedFeatureIndex < this.buffers.readCount
    ) {
      const idx = state.selectedFeatureIndex
      const startOffset = this.buffers.readPositions[idx * 2]
      const endOffset = this.buffers.readPositions[idx * 2 + 1]
      const y = this.buffers.readYs[idx]

      if (
        startOffset !== undefined &&
        endOffset !== undefined &&
        y !== undefined
      ) {
        // Convert to absolute positions
        const absStart = startOffset + regionStart
        const absEnd = endOffset + regionStart

        // Convert to clip-space X using high-precision split
        const splitStart = [
          Math.floor(absStart) - (Math.floor(absStart) & 0xfff),
          Math.floor(absStart) & 0xfff,
        ]
        const splitEnd = [
          Math.floor(absEnd) - (Math.floor(absEnd) & 0xfff),
          Math.floor(absEnd) & 0xfff,
        ]

        const sx1 =
          ((splitStart[0]! - bpStartHi + splitStart[1]! - bpStartLo) /
            regionLengthBp) *
            2 -
          1
        const sx2 =
          ((splitEnd[0]! - bpStartHi + splitEnd[1]! - bpStartLo) /
            regionLengthBp) *
            2 -
          1

        // Convert Y to clip-space
        const rowHeight = state.featureHeight + state.featureSpacing
        const yTopPx = y * rowHeight - state.rangeY[0]
        const yBotPx = yTopPx + state.featureHeight
        const pileupTop = 1 - (coverageOffset / canvasHeight) * 2
        const pxToClip = 2 / canvasHeight
        const syTop = pileupTop - yTopPx * pxToClip
        const syBot = pileupTop - yBotPx * pxToClip

        // Draw outline (chevron shape when zoomed in, rectangle otherwise)
        gl.useProgram(this.lineProgram)
        gl.uniform4f(this.lineUniforms.u_color!, 0, 0, 0, 1) // Black outline

        const bpPerPx = regionLengthBp / canvasWidth
        const strand = this.buffers.readStrands[idx]
        const showChevron = bpPerPx < 10 && state.featureHeight > 5
        const chevronClip = (5 / canvasWidth) * 2
        const syMid = (syTop + syBot) / 2

        let outlineData: Float32Array
        if (showChevron && strand === 1) {
          // Forward: chevron on right
          outlineData = new Float32Array([
            sx1,
            syTop,
            sx2,
            syTop,
            sx2 + chevronClip,
            syMid,
            sx2,
            syBot,
            sx1,
            syBot,
            sx1,
            syTop,
          ])
        } else if (showChevron && strand === -1) {
          // Reverse: chevron on left
          outlineData = new Float32Array([
            sx1,
            syTop,
            sx2,
            syTop,
            sx2,
            syBot,
            sx1,
            syBot,
            sx1 - chevronClip,
            syMid,
            sx1,
            syTop,
          ])
        } else {
          outlineData = new Float32Array([
            sx1,
            syTop,
            sx2,
            syTop,
            sx2,
            syBot,
            sx1,
            syBot,
            sx1,
            syTop,
          ])
        }

        gl.bindVertexArray(this.lineVAO)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, outlineData, gl.DYNAMIC_DRAW)
        gl.drawArrays(gl.LINE_STRIP, 0, outlineData.length / 2)
      }
    }

    gl.bindVertexArray(null)
  }

  private renderCoverage(
    state: RenderState,
    domainOffset: [number, number],
    colors: ColorPalette,
  ) {
    const gl = this.gl
    if (!this.buffers) {
      return
    }
    const { canvasWidth, canvasHeight } = state

    const willDrawCoverage =
      state.showCoverage &&
      this.buffers.coverageVAO &&
      this.buffers.coverageCount > 0
    if (!willDrawCoverage) {
      return
    }

    // Draw grey coverage bars - coverage uses offset-based positions
    gl.useProgram(this.coverageProgram)
    gl.uniform2f(
      this.coverageUniforms.u_visibleRange!,
      domainOffset[0],
      domainOffset[1],
    )
    gl.uniform1f(this.coverageUniforms.u_coverageHeight!, state.coverageHeight)
    gl.uniform1f(
      this.coverageUniforms.u_coverageYOffset!,
      state.coverageYOffset,
    )
    gl.uniform1f(this.coverageUniforms.u_binSize!, this.buffers.binSize)
    gl.uniform1f(this.coverageUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(this.coverageUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform3f(
      this.coverageUniforms.u_colorCoverage!,
      ...colors.colorCoverage,
    )

    gl.bindVertexArray(this.buffers.coverageVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.coverageCount)

    // Draw modification coverage bars OR SNP coverage bars (not both)
    if (
      state.showModifications &&
      this.buffers.modCoverageVAO &&
      this.buffers.modCoverageCount > 0
    ) {
      gl.useProgram(this.modCoverageProgram)
      gl.uniform2f(
        this.modCoverageUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(
        this.modCoverageUniforms.u_coverageHeight!,
        state.coverageHeight,
      )
      gl.uniform1f(
        this.modCoverageUniforms.u_coverageYOffset!,
        state.coverageYOffset,
      )
      gl.uniform1f(this.modCoverageUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.modCoverageUniforms.u_canvasWidth!, canvasWidth)

      gl.bindVertexArray(this.buffers.modCoverageVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.modCoverageCount)
    } else if (
      this.buffers.snpCoverageVAO &&
      this.buffers.snpCoverageCount > 0
    ) {
      gl.useProgram(this.snpCoverageProgram)
      gl.uniform2f(
        this.snpCoverageUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(
        this.snpCoverageUniforms.u_coverageHeight!,
        state.coverageHeight,
      )
      gl.uniform1f(
        this.snpCoverageUniforms.u_coverageYOffset!,
        state.coverageYOffset,
      )
      gl.uniform1f(this.snpCoverageUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.snpCoverageUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform3f(this.snpCoverageUniforms.u_colorBaseA!, ...colors.colorBaseA)
      gl.uniform3f(this.snpCoverageUniforms.u_colorBaseC!, ...colors.colorBaseC)
      gl.uniform3f(this.snpCoverageUniforms.u_colorBaseG!, ...colors.colorBaseG)
      gl.uniform3f(this.snpCoverageUniforms.u_colorBaseT!, ...colors.colorBaseT)

      gl.bindVertexArray(this.buffers.snpCoverageVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.snpCoverageCount)
    }

    // Draw noncov (interbase) histogram - bars growing DOWN from top
    // Height is 1/4 of coverage height to keep it compact
    const noncovHeight = state.coverageHeight / 4
    if (
      state.showInterbaseCounts &&
      this.buffers.noncovHistogramVAO &&
      this.buffers.noncovHistogramCount > 0
    ) {
      gl.useProgram(this.noncovHistogramProgram)
      gl.uniform2f(
        this.noncovHistogramUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(this.noncovHistogramUniforms.u_noncovHeight!, noncovHeight)
      gl.uniform1f(this.noncovHistogramUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.noncovHistogramUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform3f(
        this.noncovHistogramUniforms.u_colorInsertion!,
        ...colors.colorInsertion,
      )
      gl.uniform3f(
        this.noncovHistogramUniforms.u_colorSoftclip!,
        ...colors.colorSoftclip,
      )
      gl.uniform3f(
        this.noncovHistogramUniforms.u_colorHardclip!,
        ...colors.colorHardclip,
      )

      gl.bindVertexArray(this.buffers.noncovHistogramVAO)
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        6,
        this.buffers.noncovHistogramCount,
      )
    }

    // Draw interbase indicators - triangles at top of coverage area
    if (
      state.showInterbaseIndicators &&
      this.buffers.indicatorVAO &&
      this.buffers.indicatorCount > 0
    ) {
      gl.useProgram(this.indicatorProgram)
      gl.uniform2f(
        this.indicatorUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(this.indicatorUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.indicatorUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform3f(
        this.indicatorUniforms.u_colorInsertion!,
        ...colors.colorInsertion,
      )
      gl.uniform3f(
        this.indicatorUniforms.u_colorSoftclip!,
        ...colors.colorSoftclip,
      )
      gl.uniform3f(
        this.indicatorUniforms.u_colorHardclip!,
        ...colors.colorHardclip,
      )

      gl.bindVertexArray(this.buffers.indicatorVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, this.buffers.indicatorCount)
    }

    // Draw separator line at bottom of coverage area
    const lineY = 1 - (state.coverageHeight / canvasHeight) * 2
    gl.useProgram(this.lineProgram)
    gl.uniform4f(this.lineUniforms.u_color!, 0.7, 0.7, 0.7, 1)

    const lineData = new Float32Array([-1, lineY, 1, lineY])
    gl.bindVertexArray(this.lineVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, lineData, gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.LINES, 0, 2)
  }

  private renderArcs(
    state: RenderState,
    blockStartPx = 0,
    blockWidth = state.canvasWidth,
  ) {
    const gl = this.gl
    if (!this.buffers || !this.arcProgram || !this.arcLineProgram) {
      return
    }

    const { canvasWidth, canvasHeight } = state
    const lineWidth = state.arcLineWidth ?? 1

    // Draw arcs using instanced triangle strip rendering
    if (this.buffers.arcVAO && this.buffers.arcCount > 0) {
      gl.useProgram(this.arcProgram)

      const bpStartOffset = state.bpRangeX[0] - this.buffers.regionStart
      const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

      const coverageOffset = state.showCoverage ? state.coverageHeight : 0
      gl.uniform1f(this.arcUniforms.u_bpStartOffset!, bpStartOffset)
      gl.uniform1f(this.arcUniforms.u_bpRegionLength!, regionLengthBp)
      gl.uniform1f(this.arcUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform1f(this.arcUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.arcUniforms.u_blockStartPx!, blockStartPx)
      gl.uniform1f(this.arcUniforms.u_blockWidth!, blockWidth)
      gl.uniform1f(this.arcUniforms.u_coverageOffset!, coverageOffset)
      gl.uniform1f(this.arcUniforms.u_lineWidthPx!, lineWidth)
      gl.uniform1f(this.arcUniforms.u_gradientHue!, 0)

      for (let i = 0; i < NUM_ARC_COLORS; i++) {
        const c = arcColorPalette[i]!
        gl.uniform3f(this.arcUniforms[`u_arcColors[${i}]`]!, c[0], c[1], c[2])
      }

      gl.bindVertexArray(this.buffers.arcVAO)
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        (ARC_CURVE_SEGMENTS + 1) * 2,
        this.buffers.arcCount,
      )
    }

    // Draw vertical lines for inter-chromosomal / long-range
    if (this.buffers.arcLineVAO && this.buffers.arcLineCount > 0) {
      gl.useProgram(this.arcLineProgram)

      const [bpStartHi, bpStartLo] = splitPositionWithFrac(
        state.bpRangeX[0],
      )
      const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

      gl.uniform3f(
        this.arcLineUniforms.u_bpRangeX!,
        bpStartHi,
        bpStartLo,
        regionLengthBp,
      )
      gl.uniform1ui(
        this.arcLineUniforms.u_regionStart!,
        Math.floor(this.buffers.regionStart),
      )
      gl.uniform1f(this.arcLineUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.arcLineUniforms.u_blockStartPx!, blockStartPx)
      gl.uniform1f(this.arcLineUniforms.u_blockWidth!, blockWidth)
      gl.uniform1f(this.arcLineUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform1f(
        this.arcLineUniforms.u_coverageOffset!,
        state.showCoverage ? state.coverageHeight : 0,
      )

      for (let i = 0; i < NUM_LINE_COLORS; i++) {
        const c = arcLineColorPalette[i]!
        gl.uniform3f(
          this.arcLineUniforms[`u_arcLineColors[${i}]`]!,
          c[0],
          c[1],
          c[2],
        )
      }

      gl.lineWidth(lineWidth)
      gl.bindVertexArray(this.buffers.arcLineVAO)
      gl.drawArrays(gl.LINES, 0, this.buffers.arcLineCount * 2)
    }

    gl.bindVertexArray(null)
  }

  private renderSashimiArcs(
    state: RenderState,
    blockStartPx = 0,
    blockWidth = state.canvasWidth,
  ) {
    const gl = this.gl
    if (!this.buffers || !this.sashimiProgram) {
      return
    }

    if (!this.buffers.sashimiVAO || this.buffers.sashimiCount === 0) {
      return
    }

    const { canvasWidth, canvasHeight } = state
    const coverageOffset = state.showCoverage ? state.coverageYOffset : 0
    const coverageHeight = state.coverageHeight

    gl.useProgram(this.sashimiProgram)

    const bpStartOffset = state.bpRangeX[0] - this.buffers.regionStart
    const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

    gl.uniform1f(this.sashimiUniforms.u_bpStartOffset!, bpStartOffset)
    gl.uniform1f(this.sashimiUniforms.u_bpRegionLength!, regionLengthBp)
    gl.uniform1f(this.sashimiUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform1f(this.sashimiUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(this.sashimiUniforms.u_blockStartPx!, blockStartPx)
    gl.uniform1f(this.sashimiUniforms.u_blockWidth!, blockWidth)
    gl.uniform1f(this.sashimiUniforms.u_coverageOffset!, coverageOffset)
    gl.uniform1f(this.sashimiUniforms.u_coverageHeight!, coverageHeight)

    for (let i = 0; i < NUM_SASHIMI_COLORS; i++) {
      const c = sashimiColorPalette[i]!
      gl.uniform3f(
        this.sashimiUniforms[`u_sashimiColors[${i}]`]!,
        c[0],
        c[1],
        c[2],
      )
    }

    gl.bindVertexArray(this.buffers.sashimiVAO)
    gl.drawArraysInstanced(
      gl.TRIANGLE_STRIP,
      0,
      (ARC_CURVE_SEGMENTS + 1) * 2,
      this.buffers.sashimiCount,
    )
    gl.bindVertexArray(null)
  }

  private renderCloud(state: RenderState) {
    const gl = this.gl
    if (!this.buffers || !this.cloudProgram) {
      return
    }

    if (!this.buffers.cloudVAO || this.buffers.cloudCount === 0) {
      return
    }

    const { canvasHeight } = state

    const [bpStartHi, bpStartLo] = splitPositionWithFrac(
      state.bpRangeX[0],
    )
    const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

    gl.useProgram(this.cloudProgram)
    gl.uniform3f(
      this.cloudUniforms.u_bpRangeX!,
      bpStartHi,
      bpStartLo,
      regionLengthBp,
    )
    gl.uniform1ui(
      this.cloudUniforms.u_regionStart!,
      Math.floor(this.buffers.regionStart),
    )
    gl.uniform1f(this.cloudUniforms.u_featureHeight!, state.featureHeight)
    gl.uniform1f(this.cloudUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(
      this.cloudUniforms.u_coverageOffset!,
      state.showCoverage ? state.coverageHeight : 0,
    )
    gl.uniform1i(this.cloudUniforms.u_colorScheme!, state.cloudColorScheme ?? 0)

    gl.bindVertexArray(this.buffers.cloudVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.cloudCount)
    gl.bindVertexArray(null)
  }

  private deleteBuffersVAOs(buffers: GPUBuffers) {
    const gl = this.gl
    gl.deleteVertexArray(buffers.readVAO)
    if (buffers.coverageVAO) {
      gl.deleteVertexArray(buffers.coverageVAO)
    }
    if (buffers.snpCoverageVAO) {
      gl.deleteVertexArray(buffers.snpCoverageVAO)
    }
    if (buffers.noncovHistogramVAO) {
      gl.deleteVertexArray(buffers.noncovHistogramVAO)
    }
    if (buffers.indicatorVAO) {
      gl.deleteVertexArray(buffers.indicatorVAO)
    }
    if (buffers.gapVAO) {
      gl.deleteVertexArray(buffers.gapVAO)
    }
    if (buffers.mismatchVAO) {
      gl.deleteVertexArray(buffers.mismatchVAO)
    }
    if (buffers.insertionVAO) {
      gl.deleteVertexArray(buffers.insertionVAO)
    }
    if (buffers.softclipVAO) {
      gl.deleteVertexArray(buffers.softclipVAO)
    }
    if (buffers.hardclipVAO) {
      gl.deleteVertexArray(buffers.hardclipVAO)
    }
    if (buffers.modificationVAO) {
      gl.deleteVertexArray(buffers.modificationVAO)
    }
    if (buffers.modCoverageVAO) {
      gl.deleteVertexArray(buffers.modCoverageVAO)
    }
    if (buffers.arcVAO) {
      gl.deleteVertexArray(buffers.arcVAO)
    }
    if (buffers.arcLineVAO) {
      gl.deleteVertexArray(buffers.arcLineVAO)
    }
    if (buffers.cloudVAO) {
      gl.deleteVertexArray(buffers.cloudVAO)
    }
    if (buffers.sashimiVAO) {
      gl.deleteVertexArray(buffers.sashimiVAO)
    }
  }

  destroy() {
    const gl = this.gl

    // Clean up per-refName map entries
    for (const buffers of this.buffersMap.values()) {
      this.deleteBuffersVAOs(buffers)
    }
    this.buffersMap.clear()
    for (const bufs of this.glBuffersMap.values()) {
      for (const buf of bufs) {
        gl.deleteBuffer(buf)
      }
    }
    this.glBuffersMap.clear()
    for (const bufs of this.arcInstanceBuffersMap.values()) {
      for (const buf of bufs) {
        gl.deleteBuffer(buf)
      }
    }
    this.arcInstanceBuffersMap.clear()
    for (const bufs of this.sashimiInstanceBuffersMap.values()) {
      for (const buf of bufs) {
        gl.deleteBuffer(buf)
      }
    }
    this.sashimiInstanceBuffersMap.clear()
    for (const bufs of this.cloudGLBuffersMap.values()) {
      for (const buf of bufs) {
        gl.deleteBuffer(buf)
      }
    }
    this.cloudGLBuffersMap.clear()

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
    // Cloud cleanup
    for (const buf of this.cloudGLBuffers) {
      gl.deleteBuffer(buf)
    }
    if (this.cloudProgram) {
      gl.deleteProgram(this.cloudProgram)
    }
  }
}
