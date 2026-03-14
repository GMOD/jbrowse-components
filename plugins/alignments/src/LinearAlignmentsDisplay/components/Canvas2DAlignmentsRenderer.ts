import { getChainBounds } from './chainOverlayUtils.ts'
import {
  arcColorPalette,
  arcLineColorPalette,
  sashimiColorPalette,
} from './shaders/arcShaders.ts'

import type { WebGLRenderer, RenderState } from './WebGLRenderer.ts'

// base color indices used by SNP coverage
const SNP_COLOR_A = 0
const SNP_COLOR_C = 1
const SNP_COLOR_G = 2
const SNP_COLOR_T = 3
const SNP_COLOR_DEL = 5

interface Canvas2DRegionData {
  regionStart: number
  readIdToIndex: Map<string, number>
  readPositions: Uint32Array
  readYs: Uint16Array
  readFlags: Uint16Array
  readMapqs: Uint8Array
  readInsertSizes: Float32Array
  readPairOrientations: Uint8Array
  readStrands: Int8Array
  readTagColors: Uint8Array
  readChainHasSupp: Uint8Array | undefined
  numReads: number
  insertSizeStats?: { upper: number; lower: number }

  // CIGAR
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
  insertionPositions: Uint32Array
  insertionYs: Uint16Array
  insertionLengths: Uint16Array
  insertionFrequencies: Uint8Array
  numInsertions: number
  softclipPositions: Uint32Array
  softclipYs: Uint16Array
  softclipLengths: Uint16Array
  softclipFrequencies: Uint8Array
  numSoftclips: number
  hardclipPositions: Uint32Array
  hardclipYs: Uint16Array
  hardclipLengths: Uint16Array
  hardclipFrequencies: Uint8Array
  numHardclips: number
  softclipBasePositions: Uint32Array
  softclipBaseYs: Uint16Array
  softclipBaseBases: Uint8Array
  numSoftclipBases: number

  // Modifications
  modificationPositions: Uint32Array
  modificationYs: Uint16Array
  modificationColors: Uint8Array
  numModifications: number

  // Coverage
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageStartOffset: number
  numCoverageBins: number
  snpPositions: Uint32Array
  snpYOffsets: Float32Array
  snpHeights: Float32Array
  snpColorTypes: Uint8Array
  numSnpSegments: number
  noncovPositions: Uint32Array
  noncovYOffsets: Float32Array
  noncovHeights: Float32Array
  noncovColorTypes: Uint8Array
  noncovMaxCount: number
  numNoncovSegments: number
  indicatorPositions: Uint32Array
  indicatorColorTypes: Uint8Array
  numIndicators: number

  // Mod coverage
  modCovPositions: Uint32Array
  modCovYOffsets: Float32Array
  modCovHeights: Float32Array
  modCovColors: Uint8Array
  numModCovSegments: number

  // Arcs
  arcX1: Float32Array
  arcX2: Float32Array
  arcColorTypes: Float32Array
  arcIsArc: Uint8Array
  numArcs: number
  arcLinePositions: Uint32Array
  arcLineYs: Float32Array
  arcLineColorTypes: Float32Array
  numArcLines: number

  // Sashimi
  sashimiX1: Float32Array
  sashimiX2: Float32Array
  sashimiScores: Float32Array
  sashimiColorTypes: Uint8Array
  numSashimiArcs: number

  // Connecting lines
  connectingLinePositions: Uint32Array
  connectingLineYs: Uint16Array
  connectingLineColorTypes: Uint8Array
  numConnectingLines: number
}

// Gap types from CIGAR
const GAP_DELETION = 0
const GAP_SKIP = 1

// base colors (ACGT)
const BASE_COLORS: Record<number, string> = {
  0: '#00BF00', // A
  1: '#4747ff', // C
  2: '#d5bb04', // G  (amber/gold)
  3: '#f00',    // T
}

function emptyRegion(regionStart: number): Canvas2DRegionData {
  const empty32 = new Uint32Array(0)
  const empty16 = new Uint16Array(0)
  const empty8 = new Uint8Array(0)
  const emptyF32 = new Float32Array(0)
  return {
    regionStart,
    readIdToIndex: new Map(),
    readPositions: empty32,
    readYs: empty16,
    readFlags: empty16,
    readMapqs: empty8,
    readInsertSizes: emptyF32,
    readPairOrientations: empty8,
    readStrands: new Int8Array(0),
    readTagColors: empty8,
    readChainHasSupp: undefined,
    numReads: 0,
    gapPositions: empty32,
    gapYs: empty16,
    gapTypes: empty8,
    gapFrequencies: empty8,
    numGaps: 0,
    mismatchPositions: empty32,
    mismatchYs: empty16,
    mismatchBases: empty8,
    mismatchFrequencies: empty8,
    numMismatches: 0,
    insertionPositions: empty32,
    insertionYs: empty16,
    insertionLengths: empty16,
    insertionFrequencies: empty8,
    numInsertions: 0,
    softclipPositions: empty32,
    softclipYs: empty16,
    softclipLengths: empty16,
    softclipFrequencies: empty8,
    numSoftclips: 0,
    hardclipPositions: empty32,
    hardclipYs: empty16,
    hardclipLengths: empty16,
    hardclipFrequencies: empty8,
    numHardclips: 0,
    softclipBasePositions: empty32,
    softclipBaseYs: empty16,
    softclipBaseBases: empty8,
    numSoftclipBases: 0,
    modificationPositions: empty32,
    modificationYs: empty16,
    modificationColors: empty8,
    numModifications: 0,
    coverageDepths: emptyF32,
    coverageMaxDepth: 0,
    coverageStartOffset: 0,
    numCoverageBins: 0,
    snpPositions: empty32,
    snpYOffsets: emptyF32,
    snpHeights: emptyF32,
    snpColorTypes: empty8,
    numSnpSegments: 0,
    noncovPositions: empty32,
    noncovYOffsets: emptyF32,
    noncovHeights: emptyF32,
    noncovColorTypes: empty8,
    noncovMaxCount: 0,
    numNoncovSegments: 0,
    indicatorPositions: empty32,
    indicatorColorTypes: empty8,
    numIndicators: 0,
    modCovPositions: empty32,
    modCovYOffsets: emptyF32,
    modCovHeights: emptyF32,
    modCovColors: empty8,
    numModCovSegments: 0,
    arcX1: emptyF32,
    arcX2: emptyF32,
    arcColorTypes: emptyF32,
    arcIsArc: empty8,
    numArcs: 0,
    arcLinePositions: empty32,
    arcLineYs: emptyF32,
    arcLineColorTypes: emptyF32,
    numArcLines: 0,
    sashimiX1: emptyF32,
    sashimiX2: emptyF32,
    sashimiScores: emptyF32,
    sashimiColorTypes: empty8,
    numSashimiArcs: 0,
    connectingLinePositions: empty32,
    connectingLineYs: empty16,
    connectingLineColorTypes: empty8,
    numConnectingLines: 0,
  }
}

export class Canvas2DAlignmentsRenderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private regions = new Map<number, Canvas2DRegionData>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  uploadFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadFromTypedArrays']>[0],
  ) {
    let r = this.regions.get(regionNumber)
    if (!r) {
      r = emptyRegion(data.regionStart)
      this.regions.set(regionNumber, r)
    }
    r.regionStart = data.regionStart
    r.readPositions = data.readPositions
    r.readYs = data.readYs
    r.readFlags = data.readFlags
    r.readMapqs = data.readMapqs
    r.readInsertSizes = data.readInsertSizes
    r.readPairOrientations = data.readPairOrientations
    r.readStrands = data.readStrands
    r.readTagColors = data.readTagColors
    r.readChainHasSupp = data.readChainHasSupp
    r.numReads = data.numReads
    r.insertSizeStats = data.insertSizeStats
    r.readIdToIndex = new Map()
    for (let i = 0; i < data.numReads; i++) {
      r.readIdToIndex.set(data.readIds[i]!, i)
    }
  }

  uploadCigarFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadCigarFromTypedArrays']>[0],
  ) {
    const r = this.regions.get(regionNumber)
    if (!r) {
      return
    }
    r.gapPositions = data.gapPositions
    r.gapYs = data.gapYs
    r.gapTypes = data.gapTypes
    r.gapFrequencies = data.gapFrequencies
    r.numGaps = data.numGaps
    r.mismatchPositions = data.mismatchPositions
    r.mismatchYs = data.mismatchYs
    r.mismatchBases = data.mismatchBases
    r.mismatchFrequencies = data.mismatchFrequencies
    r.numMismatches = data.numMismatches

    // Split interbases into types
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

    const extractInterbases = (indices: number[]) => ({
      positions: new Uint32Array(indices.map(i => data.interbasePositions[i]!)),
      ys: new Uint16Array(indices.map(i => data.interbaseYs[i]!)),
      lengths: new Uint16Array(indices.map(i => data.interbaseLengths[i]!)),
      frequencies: new Uint8Array(indices.map(i => data.interbaseFrequencies[i]!)),
    })

    const ins = extractInterbases(insIdx)
    r.insertionPositions = ins.positions
    r.insertionYs = ins.ys
    r.insertionLengths = ins.lengths
    r.insertionFrequencies = ins.frequencies
    r.numInsertions = insIdx.length

    const sc = extractInterbases(scIdx)
    r.softclipPositions = sc.positions
    r.softclipYs = sc.ys
    r.softclipLengths = sc.lengths
    r.softclipFrequencies = sc.frequencies
    r.numSoftclips = scIdx.length

    const hc = extractInterbases(hcIdx)
    r.hardclipPositions = hc.positions
    r.hardclipYs = hc.ys
    r.hardclipLengths = hc.lengths
    r.hardclipFrequencies = hc.frequencies
    r.numHardclips = hcIdx.length

    r.softclipBasePositions = data.softclipBasePositions
    r.softclipBaseYs = data.softclipBaseYs
    r.softclipBaseBases = data.softclipBaseBases
    r.numSoftclipBases = data.numSoftclipBases
  }

  uploadModificationsFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadModificationsFromTypedArrays']>[0],
  ) {
    const r = this.regions.get(regionNumber)
    if (!r) {
      return
    }
    r.modificationPositions = data.modificationPositions
    r.modificationYs = data.modificationYs
    r.modificationColors = data.modificationColors
    r.numModifications = data.numModifications
  }

  uploadCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadCoverageFromTypedArrays']>[0],
  ) {
    const r = this.regions.get(regionNumber)
    if (!r) {
      return
    }
    r.coverageDepths = data.coverageDepths
    r.coverageMaxDepth = data.coverageMaxDepth
    r.coverageStartOffset = data.coverageStartOffset
    r.numCoverageBins = data.numCoverageBins
    r.snpPositions = data.snpPositions
    r.snpYOffsets = data.snpYOffsets
    r.snpHeights = data.snpHeights
    r.snpColorTypes = data.snpColorTypes
    r.numSnpSegments = data.numSnpSegments
    r.noncovPositions = data.noncovPositions
    r.noncovYOffsets = data.noncovYOffsets
    r.noncovHeights = data.noncovHeights
    r.noncovColorTypes = data.noncovColorTypes
    r.noncovMaxCount = data.noncovMaxCount
    r.numNoncovSegments = data.numNoncovSegments
    r.indicatorPositions = data.indicatorPositions
    r.indicatorColorTypes = data.indicatorColorTypes
    r.numIndicators = data.numIndicators
  }

  uploadModCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadModCoverageFromTypedArrays']>[0],
  ) {
    const r = this.regions.get(regionNumber)
    if (!r) {
      return
    }
    r.modCovPositions = data.modCovPositions
    r.modCovYOffsets = data.modCovYOffsets
    r.modCovHeights = data.modCovHeights
    r.modCovColors = data.modCovColors
    r.numModCovSegments = data.numModCovSegments
  }

  uploadSashimiFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadSashimiFromTypedArrays']>[0],
  ) {
    const r = this.regions.get(regionNumber)
    if (!r) {
      return
    }
    r.sashimiX1 = data.sashimiX1
    r.sashimiX2 = data.sashimiX2
    r.sashimiScores = data.sashimiScores
    r.sashimiColorTypes = data.sashimiColorTypes
    r.numSashimiArcs = data.numSashimiArcs
  }

  uploadArcsFromTypedArraysForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadArcsFromTypedArrays']>[0],
  ) {
    let r = this.regions.get(regionNumber)
    if (!r) {
      r = emptyRegion(data.regionStart)
      this.regions.set(regionNumber, r)
    }
    r.arcX1 = data.arcX1
    r.arcX2 = data.arcX2
    r.arcColorTypes = data.arcColorTypes
    r.arcIsArc = data.arcIsArc
    r.numArcs = data.numArcs
    r.arcLinePositions = data.linePositions
    r.arcLineYs = data.lineYs
    r.arcLineColorTypes = data.lineColorTypes
    r.numArcLines = data.numLines
  }

  uploadConnectingLinesForRegion(
    regionNumber: number,
    data: Parameters<WebGLRenderer['uploadConnectingLinesFromTypedArrays']>[0],
  ) {
    let r = this.regions.get(regionNumber)
    if (!r) {
      r = emptyRegion(data.regionStart)
      this.regions.set(regionNumber, r)
    }
    r.connectingLinePositions = data.connectingLinePositions
    r.connectingLineYs = data.connectingLineYs
    r.connectingLineColorTypes = data.connectingLineColorTypes
    r.numConnectingLines = data.numConnectingLines
  }

  ensureBuffers(_regionStart: number) {
    // no-op for Canvas 2D
  }

  clearLegacyBuffers() {
    this.regions.clear()
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
    const { canvasWidth, canvasHeight } = state
    const dpr = window.devicePixelRatio || 1
    const bufW = Math.round(canvasWidth * dpr)
    const bufH = Math.round(canvasHeight * dpr)

    if (this.canvas.width !== bufW || this.canvas.height !== bufH) {
      this.canvas.width = bufW
      this.canvas.height = bufH
    }

    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    if (this.regions.size === 0) {
      return
    }

    const arcsHeight =
      state.showArcs && state.arcsHeight ? state.arcsHeight : 0
    const covH = state.showCoverage ? state.coverageHeight : 0
    const pileupTop = covH + arcsHeight
    const mode = state.renderingMode ?? 'pileup'

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
      const bpLength = block.bpRangeX[1] - block.bpRangeX[0]

      ctx.save()
      ctx.beginPath()
      ctx.rect(scissorX, 0, scissorW, canvasHeight)
      ctx.clip()

      if (state.showCoverage) {
        this.drawCoverage(ctx, region, block, bpLength, fullBlockWidth, state)
      }

      if (state.showSashimiArcs) {
        this.drawSashimiArcs(
          ctx, region, block, bpLength, fullBlockWidth, state,
        )
      }

      // Clip pileup area
      ctx.save()
      ctx.beginPath()
      ctx.rect(scissorX, pileupTop, scissorW, canvasHeight - pileupTop)
      ctx.clip()

      if (mode === 'linkedRead') {
        this.drawConnectingLines(
          ctx, region, block, bpLength, fullBlockWidth, state,
        )
      }

      this.drawReads(ctx, region, block, bpLength, fullBlockWidth, state)

      if (state.showMismatches) {
        this.drawGaps(ctx, region, block, bpLength, fullBlockWidth, state)
        this.drawMismatches(ctx, region, block, bpLength, fullBlockWidth, state)
        this.drawInsertions(ctx, region, block, bpLength, fullBlockWidth, state)
      }

      this.drawSoftclips(ctx, region, block, bpLength, fullBlockWidth, state)
      this.drawHardclips(ctx, region, block, bpLength, fullBlockWidth, state)

      if (state.showSoftClipping) {
        this.drawSoftclipBases(
          ctx, region, block, bpLength, fullBlockWidth, state,
        )
      }

      if (state.showModifications) {
        this.drawModifications(
          ctx, region, block, bpLength, fullBlockWidth, state,
        )
      }

      // Feature highlight/selection overlays
      this.drawHighlightOverlays(ctx, region, block, state)

      if (mode === 'linkedRead') {
        this.drawChainOverlays(ctx, region, block, state)
      }

      ctx.restore() // pileup clip

      if (arcsHeight > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(scissorX, covH, scissorW, arcsHeight)
        ctx.clip()
        this.drawArcs(ctx, region, block, bpLength, fullBlockWidth, state, covH)
        ctx.restore()
      }

      ctx.restore() // block clip
    }
  }

  private bpToScreenX(
    absBp: number,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
  ) {
    return (
      block.screenStartPx +
      ((absBp - block.bpRangeX[0]) / bpLength) * fullBlockWidth
    )
  }

  private rgbStr(c: [number, number, number]) {
    return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`
  }

  private getReadColor(
    i: number,
    region: Canvas2DRegionData,
    state: RenderState,
  ) {
    const colorScheme = state.colorScheme
    const flags = region.readFlags[i]!
    const strand = region.readStrands[i]!

    // Color scheme 8 = tag-based coloring
    if (colorScheme === 8 && region.readTagColors.length > 0) {
      const r = region.readTagColors[i * 3]!
      const g = region.readTagColors[i * 3 + 1]!
      const b = region.readTagColors[i * 3 + 2]!
      if (r !== 0 || g !== 0 || b !== 0) {
        return `rgb(${r},${g},${b})`
      }
    }

    // Normal color scheme: supplementary reads shown in orange
    if (colorScheme === 0 && (flags & 2048) !== 0) {
      return this.rgbStr(state.colors.colorSupplementary)
    }

    // Default: strand coloring
    if (strand >= 0) {
      return this.rgbStr(state.colors.colorFwdStrand)
    }
    return this.rgbStr(state.colors.colorRevStrand)
  }

  private drawReads(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    const covOffset =
      (state.showCoverage ? state.coverageHeight : 0) +
      (state.showArcs && state.arcsHeight ? state.arcsHeight : 0)
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing

    for (let i = 0; i < region.numReads; i++) {
      const startBp = region.readPositions[i * 2]! + region.regionStart
      const endBp = region.readPositions[i * 2 + 1]! + region.regionStart
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const y = region.readYs[i]! * (fH + fSpacing) + covOffset - state.rangeY[0]
      const w = Math.max(1, x2 - x1)

      ctx.fillStyle = this.getReadColor(i, region, state)
      ctx.fillRect(x1, y, w, fH)

      if (state.showOutline && w > 2) {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'
        ctx.lineWidth = 0.5
        ctx.strokeRect(x1, y, w, fH)
      }
    }
  }

  private drawGaps(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    const covOffset =
      (state.showCoverage ? state.coverageHeight : 0) +
      (state.showArcs && state.arcsHeight ? state.arcsHeight : 0)
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing

    for (let i = 0; i < region.numGaps; i++) {
      const startBp = region.gapPositions[i * 2]! + region.regionStart
      const endBp = region.gapPositions[i * 2 + 1]! + region.regionStart
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const yRow = region.gapYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]
      const gapType = region.gapTypes[i]!
      const w = Math.max(1, x2 - x1)

      if (gapType === GAP_DELETION) {
        // Deletion: dark line through read
        const midY = y + fH / 2
        ctx.fillStyle = `rgb(${Math.round(state.colors.colorDeletion[0] * 255)},${Math.round(state.colors.colorDeletion[1] * 255)},${Math.round(state.colors.colorDeletion[2] * 255)})`
        ctx.fillRect(x1, midY - 0.5, w, 1)
      } else if (gapType === GAP_SKIP) {
        // Skip/intron: thin line with lighter color
        ctx.fillStyle = `rgb(${Math.round(state.colors.colorSkip[0] * 255)},${Math.round(state.colors.colorSkip[1] * 255)},${Math.round(state.colors.colorSkip[2] * 255)})`
        // Erase the read body first
        ctx.clearRect(x1, y, w, fH)
        const midY = y + fH / 2
        ctx.fillRect(x1, midY - 0.5, w, 1)
      }
    }
  }

  private drawMismatches(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    const covOffset =
      (state.showCoverage ? state.coverageHeight : 0) +
      (state.showArcs && state.arcsHeight ? state.arcsHeight : 0)
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const bpPerPx = bpLength / fullBlockWidth

    for (let i = 0; i < region.numMismatches; i++) {
      const bp = region.mismatchPositions[i]! + region.regionStart
      const x = this.bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const w = Math.max(1, 1 / bpPerPx)
      const yRow = region.mismatchYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]
      const base = region.mismatchBases[i]!
      const color = BASE_COLORS[base] ?? '#999'
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, fH)
    }
  }

  private drawInsertions(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    const covOffset =
      (state.showCoverage ? state.coverageHeight : 0) +
      (state.showArcs && state.arcsHeight ? state.arcsHeight : 0)
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const insColor = `rgb(${Math.round(state.colors.colorInsertion[0] * 255)},${Math.round(state.colors.colorInsertion[1] * 255)},${Math.round(state.colors.colorInsertion[2] * 255)})`

    for (let i = 0; i < region.numInsertions; i++) {
      const bp = region.insertionPositions[i]! + region.regionStart
      const x = this.bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const yRow = region.insertionYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]

      ctx.fillStyle = insColor
      // Insertion indicator: vertical line + small triangle
      ctx.fillRect(x - 0.5, y, 1, fH)
      // Top triangle
      ctx.beginPath()
      ctx.moveTo(x - 2, y)
      ctx.lineTo(x + 2, y)
      ctx.lineTo(x, y + 2)
      ctx.closePath()
      ctx.fill()
      // Bottom triangle
      ctx.beginPath()
      ctx.moveTo(x - 2, y + fH)
      ctx.lineTo(x + 2, y + fH)
      ctx.lineTo(x, y + fH - 2)
      ctx.closePath()
      ctx.fill()
    }
  }

  private drawSoftclips(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (region.numSoftclips === 0) {
      return
    }
    const covOffset =
      (state.showCoverage ? state.coverageHeight : 0) +
      (state.showArcs && state.arcsHeight ? state.arcsHeight : 0)
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const scColor = `rgb(${Math.round(state.colors.colorSoftclip[0] * 255)},${Math.round(state.colors.colorSoftclip[1] * 255)},${Math.round(state.colors.colorSoftclip[2] * 255)})`
    const bpPerPx = bpLength / fullBlockWidth

    for (let i = 0; i < region.numSoftclips; i++) {
      const bp = region.softclipPositions[i]! + region.regionStart
      const x = this.bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const yRow = region.softclipYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]
      const len = region.softclipLengths[i]!
      const w = Math.max(1, len / bpPerPx)

      ctx.fillStyle = scColor
      ctx.fillRect(x, y, w, fH)
    }
  }

  private drawHardclips(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (region.numHardclips === 0) {
      return
    }
    const covOffset =
      (state.showCoverage ? state.coverageHeight : 0) +
      (state.showArcs && state.arcsHeight ? state.arcsHeight : 0)
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const hcColor = `rgb(${Math.round(state.colors.colorHardclip[0] * 255)},${Math.round(state.colors.colorHardclip[1] * 255)},${Math.round(state.colors.colorHardclip[2] * 255)})`
    const bpPerPx = bpLength / fullBlockWidth

    for (let i = 0; i < region.numHardclips; i++) {
      const bp = region.hardclipPositions[i]! + region.regionStart
      const x = this.bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const yRow = region.hardclipYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]
      const len = region.hardclipLengths[i]!
      const w = Math.max(1, len / bpPerPx)

      ctx.fillStyle = hcColor
      ctx.fillRect(x, y, w, fH)
    }
  }

  private drawSoftclipBases(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (region.numSoftclipBases === 0) {
      return
    }
    const covOffset =
      (state.showCoverage ? state.coverageHeight : 0) +
      (state.showArcs && state.arcsHeight ? state.arcsHeight : 0)
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const bpPerPx = bpLength / fullBlockWidth

    for (let i = 0; i < region.numSoftclipBases; i++) {
      const bp = region.softclipBasePositions[i]! + region.regionStart
      const x = this.bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const w = Math.max(1, 1 / bpPerPx)
      const yRow = region.softclipBaseYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]
      const base = region.softclipBaseBases[i]!
      const color = BASE_COLORS[base] ?? '#999'
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, fH)
    }
  }

  private drawModifications(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (region.numModifications === 0) {
      return
    }
    const covOffset =
      (state.showCoverage ? state.coverageHeight : 0) +
      (state.showArcs && state.arcsHeight ? state.arcsHeight : 0)
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const bpPerPx = bpLength / fullBlockWidth

    for (let i = 0; i < region.numModifications; i++) {
      const bp = region.modificationPositions[i]! + region.regionStart
      const x = this.bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const w = Math.max(1, 1 / bpPerPx)
      const yRow = region.modificationYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]
      const ci = i * 4
      const r = region.modificationColors[ci]!
      const g = region.modificationColors[ci + 1]!
      const b = region.modificationColors[ci + 2]!
      const a = region.modificationColors[ci + 3]! / 255
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`
      ctx.fillRect(x, y, w, fH)
    }
  }

  private drawCoverage(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (region.numCoverageBins === 0) {
      return
    }
    const covH = state.coverageHeight
    const covYOffset = state.coverageYOffset

    // Draw coverage histogram
    const covColor = `rgb(${Math.round(state.colors.colorCoverage[0] * 255)},${Math.round(state.colors.colorCoverage[1] * 255)},${Math.round(state.colors.colorCoverage[2] * 255)})`
    ctx.fillStyle = covColor

    for (let i = 0; i < region.numCoverageBins; i++) {
      const binBp = region.coverageStartOffset + i + region.regionStart
      const x = this.bpToScreenX(binBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(binBp + 1, block, bpLength, fullBlockWidth)
      const depth = (region.coverageDepths[i] ?? 0) / region.coverageMaxDepth
      const barH = depth * (covH - covYOffset * 2)
      const y = covYOffset + (covH - covYOffset * 2) - barH
      ctx.fillRect(x, y, Math.max(1, x2 - x), barH)
    }

    // Draw SNP coverage colored segments
    this.drawSnpCoverage(ctx, region, block, bpLength, fullBlockWidth, state)

    // Draw mod coverage
    this.drawModCoverage(ctx, region, block, bpLength, fullBlockWidth, state)
  }

  private getSnpColor(colorType: number, state: RenderState) {
    switch (colorType) {
      case SNP_COLOR_A:
        return `rgb(${Math.round(state.colors.colorBaseA[0] * 255)},${Math.round(state.colors.colorBaseA[1] * 255)},${Math.round(state.colors.colorBaseA[2] * 255)})`
      case SNP_COLOR_C:
        return `rgb(${Math.round(state.colors.colorBaseC[0] * 255)},${Math.round(state.colors.colorBaseC[1] * 255)},${Math.round(state.colors.colorBaseC[2] * 255)})`
      case SNP_COLOR_G:
        return `rgb(${Math.round(state.colors.colorBaseG[0] * 255)},${Math.round(state.colors.colorBaseG[1] * 255)},${Math.round(state.colors.colorBaseG[2] * 255)})`
      case SNP_COLOR_T:
        return `rgb(${Math.round(state.colors.colorBaseT[0] * 255)},${Math.round(state.colors.colorBaseT[1] * 255)},${Math.round(state.colors.colorBaseT[2] * 255)})`
      case SNP_COLOR_DEL:
        return `rgb(${Math.round(state.colors.colorDeletion[0] * 255)},${Math.round(state.colors.colorDeletion[1] * 255)},${Math.round(state.colors.colorDeletion[2] * 255)})`
      default:
        return 'rgb(200,200,200)' // reference
    }
  }

  private drawSnpCoverage(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (region.numSnpSegments === 0) {
      return
    }
    const covH = state.coverageHeight
    const covYOffset = state.coverageYOffset
    const bpPerPx = bpLength / fullBlockWidth

    for (let i = 0; i < region.numSnpSegments; i++) {
      const bp = region.snpPositions[i]! + region.regionStart
      const x = this.bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const w = Math.max(1, 1 / bpPerPx)
      const yOffset = region.snpYOffsets[i]!
      const h = region.snpHeights[i]!
      const colorType = region.snpColorTypes[i]!
      const barH = h * (covH - covYOffset * 2)
      const y = covYOffset + (1 - yOffset - h) * (covH - covYOffset * 2)

      ctx.fillStyle = this.getSnpColor(colorType, state)
      ctx.fillRect(x, y, w, barH)
    }
  }

  private drawModCoverage(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (region.numModCovSegments === 0) {
      return
    }
    const covH = state.coverageHeight
    const covYOffset = state.coverageYOffset
    const bpPerPx = bpLength / fullBlockWidth

    for (let i = 0; i < region.numModCovSegments; i++) {
      const bp = region.modCovPositions[i]! + region.regionStart
      const x = this.bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const w = Math.max(1, 1 / bpPerPx)
      const yOffset = region.modCovYOffsets[i]!
      const h = region.modCovHeights[i]!
      const ci = i * 4
      const r = region.modCovColors[ci]!
      const g = region.modCovColors[ci + 1]!
      const b = region.modCovColors[ci + 2]!
      const a = region.modCovColors[ci + 3]! / 255
      const barH = h * (covH - covYOffset * 2)
      const y = covYOffset + (1 - yOffset - h) * (covH - covYOffset * 2)

      ctx.fillStyle = `rgba(${r},${g},${b},${a})`
      ctx.fillRect(x, y, w, barH)
    }
  }

  private paletteColor(palette: [number, number, number][], idx: number) {
    const c = palette[idx % palette.length]!
    return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`
  }

  private drawArcs(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
    arcsTop: number,
  ) {
    const arcsH = state.arcsHeight ?? 0
    const lineWidth = state.arcLineWidth ?? 1

    // Draw filled arcs
    for (let i = 0; i < region.numArcs; i++) {
      const x1Bp = region.arcX1[i]! + region.regionStart
      const x2Bp = region.arcX2[i]! + region.regionStart
      const colorIdx = Math.round(region.arcColorTypes[i]!)

      const sx1 = this.bpToScreenX(x1Bp, block, bpLength, fullBlockWidth)
      const sx2 = this.bpToScreenX(x2Bp, block, bpLength, fullBlockWidth)
      const midX = (sx1 + sx2) / 2
      const span = Math.abs(sx2 - sx1)
      const arcH = Math.min(span * 0.5, arcsH - 2)

      ctx.strokeStyle = this.paletteColor(arcColorPalette, colorIdx)
      ctx.lineWidth = lineWidth
      ctx.beginPath()
      ctx.moveTo(sx1, arcsTop + arcsH)
      ctx.quadraticCurveTo(midX, arcsTop + arcsH - arcH, sx2, arcsTop + arcsH)
      ctx.stroke()
    }

    // Draw arc lines (straight lines between positions)
    for (let i = 0; i < region.numArcLines; i++) {
      const bp = region.arcLinePositions[i]! + region.regionStart
      const x = this.bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const y = arcsTop + region.arcLineYs[i]! * arcsH
      const colorIdx = Math.round(region.arcLineColorTypes[i]!)

      ctx.fillStyle = this.paletteColor(arcLineColorPalette, colorIdx)
      ctx.fillRect(x - 1, y - 1, 2, 2)
    }
  }

  private drawSashimiArcs(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (region.numSashimiArcs === 0) {
      return
    }
    const covH = state.showCoverage ? state.coverageHeight : 0
    const covYOffset = state.showCoverage ? state.coverageYOffset : 0

    for (let i = 0; i < region.numSashimiArcs; i++) {
      const x1Bp = region.sashimiX1[i]! + region.regionStart
      const x2Bp = region.sashimiX2[i]! + region.regionStart
      const colorIdx = region.sashimiColorTypes[i]!
      const score = region.sashimiScores[i]!

      const sx1 = this.bpToScreenX(x1Bp, block, bpLength, fullBlockWidth)
      const sx2 = this.bpToScreenX(x2Bp, block, bpLength, fullBlockWidth)
      const midX = (sx1 + sx2) / 2
      const arcH = Math.min(
        Math.abs(sx2 - sx1) * 0.3,
        (covH - covYOffset * 2) * 0.8,
      )

      ctx.strokeStyle = this.paletteColor(sashimiColorPalette, colorIdx)
      ctx.lineWidth = Math.max(1, Math.min(score / 5, 4))
      ctx.beginPath()
      ctx.moveTo(sx1, covYOffset)
      ctx.quadraticCurveTo(midX, covYOffset + arcH, sx2, covYOffset)
      ctx.stroke()
    }
  }

  private drawConnectingLines(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (region.numConnectingLines === 0) {
      return
    }
    const covOffset =
      (state.showCoverage ? state.coverageHeight : 0) +
      (state.showArcs && state.arcsHeight ? state.arcsHeight : 0)
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing

    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1

    for (let i = 0; i < region.numConnectingLines; i++) {
      const startBp =
        region.connectingLinePositions[i * 2]! + region.regionStart
      const endBp =
        region.connectingLinePositions[i * 2 + 1]! + region.regionStart
      const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const yRow = region.connectingLineYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0] + fH / 2

      ctx.beginPath()
      ctx.moveTo(x1, y)
      ctx.lineTo(x2, y)
      ctx.stroke()
    }
  }

  private drawHighlightOverlays(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: {
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    },
    state: RenderState,
  ) {
    const covOffset =
      (state.showCoverage ? state.coverageHeight : 0) +
      (state.showArcs && state.arcsHeight ? state.arcsHeight : 0)
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const bpLength = block.bpRangeX[1] - block.bpRangeX[0]
    const fullBlockWidth = block.screenEndPx - block.screenStartPx

    if (
      state.highlightedChainIds.length === 0 &&
      state.highlightedFeatureId
    ) {
      const idx = region.readIdToIndex.get(state.highlightedFeatureId)
      if (idx !== undefined && idx < region.numReads) {
        const startBp = region.readPositions[idx * 2]! + region.regionStart
        const endBp = region.readPositions[idx * 2 + 1]! + region.regionStart
        const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
        const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
        const y =
          region.readYs[idx]! * (fH + fSpacing) + covOffset - state.rangeY[0]
        ctx.fillStyle = 'rgba(0,0,0,0.15)'
        ctx.fillRect(x1, y, x2 - x1, fH)
      }
    }

    if (
      state.selectedChainIds.length === 0 &&
      state.selectedFeatureId
    ) {
      const idx = region.readIdToIndex.get(state.selectedFeatureId)
      if (idx !== undefined && idx < region.numReads) {
        const startBp = region.readPositions[idx * 2]! + region.regionStart
        const endBp = region.readPositions[idx * 2 + 1]! + region.regionStart
        const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
        const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
        const y =
          region.readYs[idx]! * (fH + fSpacing) + covOffset - state.rangeY[0]
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'
        ctx.lineWidth = 2
        ctx.strokeRect(x1, y, x2 - x1, fH)
      }
    }
  }

  private drawChainOverlays(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: {
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    },
    state: RenderState,
  ) {
    const covOffset =
      (state.showCoverage ? state.coverageHeight : 0) +
      (state.showArcs && state.arcsHeight ? state.arcsHeight : 0)
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const bpLength = block.bpRangeX[1] - block.bpRangeX[0]
    const fullBlockWidth = block.screenEndPx - block.screenStartPx

    if (state.highlightedChainIds.length > 0) {
      const bounds = getChainBounds(
        state.highlightedChainIds,
        region.readIdToIndex,
        region.readPositions,
        region.readYs,
      )
      if (bounds) {
        const startBp = bounds.minStart + region.regionStart
        const endBp = bounds.maxEnd + region.regionStart
        const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
        const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
        const y =
          bounds.y * (fH + fSpacing) + covOffset - state.rangeY[0]
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        ctx.fillRect(x1, y, x2 - x1, fH)
      }
    }

    if (state.selectedChainIds.length > 0) {
      const bounds = getChainBounds(
        state.selectedChainIds,
        region.readIdToIndex,
        region.readPositions,
        region.readYs,
      )
      if (bounds) {
        const startBp = bounds.minStart + region.regionStart
        const endBp = bounds.maxEnd + region.regionStart
        const x1 = this.bpToScreenX(startBp, block, bpLength, fullBlockWidth)
        const x2 = this.bpToScreenX(endBp, block, bpLength, fullBlockWidth)
        const y =
          bounds.y * (fH + fSpacing) + covOffset - state.rangeY[0]
        ctx.strokeStyle = 'rgba(0,0,0,1)'
        ctx.lineWidth = 2
        ctx.strokeRect(x1, y, x2 - x1, fH)
      }
    }
  }

  pruneStaleRegions(activeRegionNumbers: Set<number>) {
    for (const regionNumber of this.regions.keys()) {
      if (!activeRegionNumbers.has(regionNumber)) {
        this.regions.delete(regionNumber)
      }
    }
  }

  destroy() {
    this.regions.clear()
  }
}
