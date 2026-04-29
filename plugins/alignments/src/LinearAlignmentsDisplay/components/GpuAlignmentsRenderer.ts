import { getDpr } from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { slangPass } from '@jbrowse/core/gpu/slangPass'
import { splitPositionWithFrac } from '@jbrowse/core/gpu/webglUtils'
import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'

import { getChainBounds, toClipRect } from './chainOverlayUtils.ts'
import {
  buildReadIdToIndex,
  computeBlockHeights,
  ensureRegion,
} from './rendererTypes.ts'
import {
  ARC_LINE_PASS,
  ARC_PASS,
  PASS_ARC,
  PASS_ARC_LINE,
} from '../../features/arcs/packGpu.ts'
import { uploadArcs } from '../../features/arcs/uploadGpu.ts'
import {
  CONN_LINE_PASS,
  PASS_CONN_LINE,
} from '../../features/connectingLines/packGpu.ts'
import { uploadConnectingLines } from '../../features/connectingLines/uploadGpu.ts'
import {
  COVERAGE_PASS,
  PASS_COVERAGE,
} from '../../features/coverage/packGpu.ts'
import { uploadCoverageBins } from '../../features/coverage/uploadGpu.ts'
import { GAP_PASS, PASS_GAP } from '../../features/gap/packGpu.ts'
import { uploadGaps } from '../../features/gap/uploadGpu.ts'
import {
  INDICATOR_PASS,
  PASS_INDICATOR,
} from '../../features/indicator/packGpu.ts'
import { uploadIndicators } from '../../features/indicator/uploadGpu.ts'
import {
  INSERTION_PASS,
  PASS_INSERTION,
} from '../../features/insertion/packGpu.ts'
import { uploadInsertions } from '../../features/insertion/uploadGpu.ts'
import {
  LINKED_READ_LINE_PASS,
  PASS_LINKED_READ_LINE,
} from '../../features/linkedReads/packGpu.ts'
import { uploadLinkedReadLines } from '../../features/linkedReads/uploadGpu.ts'
import {
  MISMATCH_PASS,
  PASS_MISMATCH,
} from '../../features/mismatch/packGpu.ts'
import { uploadMismatches } from '../../features/mismatch/uploadGpu.ts'
import {
  MOD_COVERAGE_PASS,
  PASS_MOD_COV,
} from '../../features/modCoverage/packGpu.ts'
import { uploadModCoverage } from '../../features/modCoverage/uploadGpu.ts'
import {
  MODIFICATION_PASS,
  PASS_MOD,
} from '../../features/modification/packGpu.ts'
import { uploadModifications } from '../../features/modification/uploadGpu.ts'
import { NONCOV_PASS, PASS_NONCOV } from '../../features/noncov/packGpu.ts'
import { uploadNoncov } from '../../features/noncov/uploadGpu.ts'
import { PASS_READ, READ_PASS } from '../../features/read/packGpu.ts'
import { uploadReads as uploadReadSegments } from '../../features/read/uploadGpu.ts'
import {
  PASS_SNP_COV,
  SNP_COVERAGE_PASS,
} from '../../features/snpCoverage/packGpu.ts'
import { uploadSnpCoverage } from '../../features/snpCoverage/uploadGpu.ts'
import {
  PASS_SOFTCLIP_BASES,
  SOFTCLIP_BASES_PASS,
} from '../../features/softclip/packBases.ts'
import { uploadSoftclipBases } from '../../features/softclip/uploadBases.ts'
import {
  ARC_HEIGHT_MARGIN,
  arcLineColorPalette,
  getArcPalette,
  linkedReadColorPalette,
} from '../../shaders/palettes.ts'
import * as flatQuadShader from '../../shaders/slang/flatQuad.generated.ts'
import * as readShader from '../../shaders/slang/read.generated.ts'
import { CLIP_PASS, PASS_CLIP, uploadClips } from '../../shared/clipPass.ts'

import type {
  AlignmentsBackend,
  AlignmentsSources,
  BaseRegionData,
  ColorPalette,
  CoverageUploadData,
  RGBColor,
  ReadUploadData,
  RenderBlock,
  RenderState,
} from './rendererTypes.ts'
import type { ArcColorByType } from '../../shared/types.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

// Shader strides — every pass shares the same Uniforms struct (see
// shaders/slang/alignmentsUniforms.slang) so we use any module's
// UNIFORMS_SIZE_BYTES. Keep one shared ArrayBuffer for the UBO.
const UNIFORMS_SIZE_BYTES = readShader.UNIFORMS_SIZE_BYTES
const U = readShader.UNIFORM_OFFSET_F32
const USLOTS = readShader.UNIFORM_SLOT_ARRAYS

// Pass IDs not yet hosted by a feature folder. Per-feature PASS_* constants
// are imported from features/X/packGpu.ts.
const PASS_FLAT_QUAD = 'flatQuad'

// Fill the per-frame UBO slots. Pure — mutates only the given typed-array
// views. Every field here corresponds to a `u.fieldName` in
// alignmentsUniforms.slang; adding a new field means updating both.
function fillFrameUniforms(
  f: Float32Array,
  u: Uint32Array,
  i: Int32Array,
  state: RenderState,
  frame: BlockFrame,
) {
  const { region } = frame
  f[U.bpHi] = frame.bpHi
  f[U.bpLo] = frame.bpLo
  f[U.bpLen] = frame.clippedBpEnd - frame.clippedBpStart
  f[U.hpZero] = 0
  f[U.canvasW] = frame.canvasW
  f[U.pxPerBp] = frame.canvasW / (frame.clippedBpEnd - frame.clippedBpStart)
  f[U.canvasH] = state.canvasHeight
  // rangeY0 (pileupY) and scrollTop (connecting/linked-read shaders) are
  // the same value held in two slots; unifying needs a shader regen.
  f[U.rangeY0] = state.rangeY[0]
  f[U.scrollTop] = state.rangeY[0]
  f[U.covOffset] = state.pileupTopOffset
  f[U.featHeight] = state.featureHeight
  f[U.featSpacing] = state.featureSpacing
  f[U.covHeight] = state.coverageHeight
  f[U.covYOffset] = state.coverageYOffset
  const domainMax = state.coverageMaxDepth
  f[U.depthScale] =
    domainMax !== undefined && region.maxDepth > 0
      ? region.maxDepth / domainMax
      : 1
  f[U.depthDomainMax] = domainMax ?? 0
  i[U.coverageScaleType] = state.coverageIsLog ? 1 : 0
  f[U.binSize] = region.binSize
  f[U.noncovHeight] =
    region.noncovMaxCount > 0 ? Math.min(region.noncovMaxCount * 2, 20) : 0
  f[U.insertUpper] = region.insertSizeStats?.upper ?? 999999
  f[U.insertLower] = region.insertSizeStats?.lower ?? 0
  i[U.colorScheme] = state.colorScheme
  i[U.highlightIdx] = -1
  i[U.highlightOnly] = 0
  // Bezier mode is a chain mode for read-coloring purposes (supplementary
  // colors, strand flipping, mate-unmapped coloring, chevrons) — only the
  // connecting-line geometry differs.
  const mode = state.renderingMode ?? 'pileup'
  i[U.chainMode] = mode === 'linkedRead' || mode === 'linkedReadBezier' ? 1 : 0
  i[U.showStroke] = state.showOutline && state.featureHeight >= 4 ? 1 : 0
  i[U.flipStrandLongRead] = state.flipStrandLongReadChains !== false ? 1 : 0
  f[U.reversed] = frame.reversed ? 1 : 0
}

// ---------------------------------------------------------------------------
// Pure buffer-pack helpers. Each takes an RPC payload and returns a ready-to-
// upload ArrayBuffer matching the corresponding Slang shader's instance
// layout. They live outside the renderer class because they touch no HAL
// state — and all performance-sensitive inner loops hoist the host-object
// property accesses to locals so V8 reads through typed-array views directly.
// Per-feature pack/upload helpers live in features/X/{packGpu,uploadGpu}.ts.
// ---------------------------------------------------------------------------

// Arc-pass UBO patch. The arc shader reads the same UBO as the read pass
// but in a different viewport (above/below pileup), so we overwrite the
// viewport-sensitive slots before the draw. Pure — mutates only the views.
interface ArcFrame {
  region: LocalRegion
  block: RenderBlock
  state: RenderState
  scissorX: number
  scissorW: number
  arcViewportH: number
  dpr: number
  covOffset: number
}
function fillArcUniforms(f: Float32Array, u: Uint32Array, a: ArcFrame) {
  const { block, state, scissorX, scissorW, arcViewportH, dpr, covOffset } = a
  const blockW = block.screenEndPx - block.screenStartPx
  const [hi, lo] = splitPositionWithFrac(block.bpRangeX[0])
  f[U.covOffset] = covOffset
  f[U.canvasH] = arcViewportH / dpr
  f[U.canvasW] = scissorW
  f[U.blockStartPx] = block.screenStartPx - scissorX
  f[U.blockWidth] = blockW
  f[U.bpHi] = hi
  f[U.bpLo] = lo
  f[U.bpLen] = block.bpRangeX[1] - block.bpRangeX[0]
  f[U.lineWidthPx] = state.arcLineWidth ?? 1
  f[U.pairedArcsDown] = state.pairedArcsDown ? 1 : 0
  // Samplot picks its own domain (autoscaled |tlen|); arc mode defaults to
  // the bp-span that fits availH at the current zoom, reproducing the prior
  // `yBp * pxPerBp` math.
  const availH = a.arcViewportH / dpr - ARC_HEIGHT_MARGIN
  const pxPerBp = blockW / (block.bpRangeX[1] - block.bpRangeX[0])
  f[U.pxPerBp] = pxPerBp
  f[U.arcsYDomainBp] =
    state.arcsYDomainBp ?? (pxPerBp > 0 ? availH / pxPerBp : 1)
}

// Pack every palette color into the UBO as u32 ABGR. Pure — writes through
// the given u32 view only, no rendering side effects.
function writePaletteToUbo(
  u: Uint32Array,
  c: ColorPalette,
  arcColorByType: ArcColorByType | undefined,
) {
  const pack = (rgb: RGBColor) => normalizedRgbToABGR(rgb[0], rgb[1], rgb[2])
  u[U.colorFwd] = pack(c.colorFwdStrand)
  u[U.colorRev] = pack(c.colorRevStrand)
  u[U.colorNostrand] = pack(c.colorNostrand)
  u[U.colorPairLR] = pack(c.colorPairLR)
  u[U.colorPairRL] = pack(c.colorPairRL)
  u[U.colorPairRR] = pack(c.colorPairRR)
  u[U.colorPairLL] = pack(c.colorPairLL)
  u[U.colorBaseA] = pack(c.colorBaseA)
  u[U.colorBaseC] = pack(c.colorBaseC)
  u[U.colorBaseG] = pack(c.colorBaseG)
  u[U.colorBaseT] = pack(c.colorBaseT)
  u[U.colorInsertion] = pack(c.colorInsertion)
  u[U.colorDeletion] = pack(c.colorDeletion)
  u[U.colorSkip] = pack(c.colorSkip)
  u[U.colorSoftclip] = pack(c.colorSoftclip)
  u[U.colorHardclip] = pack(c.colorHardclip)
  u[U.colorCoverage] = pack(c.colorCoverage)
  u[U.colorModFwd] = pack(c.colorModificationFwd)
  u[U.colorModRev] = pack(c.colorModificationRev)
  u[U.colorLongInsert] = pack(c.colorLongInsert)
  u[U.colorShortInsert] = pack(c.colorShortInsert)
  u[U.colorSupplementary] = pack(c.colorSupplementary)
  u[U.colorUnmappedMate] = pack(c.colorUnmappedMate)
  const arcPal = getArcPalette(arcColorByType)
  for (let i = 0; i < arcPal.length; i++) {
    u[USLOTS.arcColor[i]!] = pack(arcPal[i]!)
  }
  for (let i = 0; i < arcLineColorPalette.length; i++) {
    u[USLOTS.arcLineColor[i]!] = pack(arcLineColorPalette[i]!)
  }
  for (let i = 0; i < linkedReadColorPalette.length; i++) {
    u[USLOTS.linkedReadColor[i]!] = pack(linkedReadColorPalette[i]!)
  }
}

export const ALIGNMENTS_PASSES: PassDescriptor[] = [
  READ_PASS,
  GAP_PASS,
  MISMATCH_PASS,
  INSERTION_PASS,
  CLIP_PASS,
  MODIFICATION_PASS,
  COVERAGE_PASS,
  SNP_COVERAGE_PASS,
  MOD_COVERAGE_PASS,
  NONCOV_PASS,
  INDICATOR_PASS,
  ARC_PASS,
  ARC_LINE_PASS,
  CONN_LINE_PASS,
  LINKED_READ_LINE_PASS,
  SOFTCLIP_BASES_PASS,
  slangPass({
    id: PASS_FLAT_QUAD,
    mod: flatQuadShader,
  }),
]

export { UNIFORMS_SIZE_BYTES }

// Pure LocalRegion constructor — empty placeholders for typed arrays the
// read/coverage uploads later overwrite.
function emptyRegion(): LocalRegion {
  return {
    readIdToIndex: new Map(),
    readPositions: new Uint32Array(0),
    readYs: new Uint16Array(0),
    readStrands: new Int8Array(0),
    maxDepth: 0,
    binSize: 1,
    noncovMaxCount: 0,
  }
}

// Per-block inputs collected before each writeUniforms call. Keeping them
// in one record avoids a 10-arg method signature and lets downstream
// overlay passes refer to the same frame without recomputation.
interface BlockFrame {
  region: LocalRegion
  bpHi: number
  bpLo: number
  clippedBpStart: number
  clippedBpEnd: number
  canvasW: number
  reversed: boolean
}

// Per-region data not tracked by the HAL
interface LocalRegion extends BaseRegionData {
  readStrands: Int8Array
  insertSizeStats?: { upper: number; lower: number }
  maxDepth: number
  binSize: number
  noncovMaxCount: number
}

const OVERLAY_REGION = 999999

export class GpuAlignmentsRenderer implements AlignmentsBackend {
  private hal: GpuHal
  private uData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uF32 = new Float32Array(this.uData)
  private uU32 = new Uint32Array(this.uData)
  private uI32 = new Int32Array(this.uData)
  private regions = new Map<number, LocalRegion>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  sync(sources: AlignmentsSources) {
    const active: number[] = []
    for (const [idx, data] of sources.laidOutPileupMap) {
      active.push(idx)
      this.uploadReads(idx, data)
      uploadGaps(this.hal, idx, data)
      uploadMismatches(this.hal, idx, data)
      uploadInsertions(this.hal, idx, data)
      uploadClips(this.hal, idx, data)
      uploadSoftclipBases(this.hal, idx, data)
      uploadModifications(this.hal, idx, data)
      this.uploadCoverage(idx, data)
      uploadModCoverage(
        this.hal,
        idx,
        data.modCovPackedBuffer,
        data.modCovPositions.length,
      )
      if (data.connectingLinePositions.length > 0) {
        ensureRegion(this.regions, idx, emptyRegion)
        uploadConnectingLines(this.hal, idx, data)
      }
      if (data.numLinkedReadLines > 0) {
        ensureRegion(this.regions, idx, emptyRegion)
        uploadLinkedReadLines(this.hal, idx, data)
      }
    }
    pruneRegionMap(this.regions, active, n => {
      this.hal.deleteRegion(n)
    })
    for (const [idx, data] of sources.arcsRpcDataMap) {
      ensureRegion(this.regions, idx, emptyRegion)
      uploadArcs(this.hal, idx, data)
    }
  }

  uploadReads(displayedRegionIndex: number, data: ReadUploadData) {
    const r = emptyRegion()
    r.insertSizeStats = data.insertSizeStats
    r.readPositions = data.readPositions
    r.readYs = data.readYs
    r.readStrands = data.readStrands
    r.readIdToIndex = buildReadIdToIndex(data.readIds, data.readIds.length)
    this.regions.set(displayedRegionIndex, r)
    uploadReadSegments(this.hal, displayedRegionIndex, data)
  }

  uploadCoverage(displayedRegionIndex: number, data: CoverageUploadData) {
    const r = this.regions.get(displayedRegionIndex)
    if (!r) {
      return
    }

    const numCoverageBins = data.coverageDepths.length
    if (numCoverageBins > 0) {
      uploadCoverageBins(
        this.hal,
        displayedRegionIndex,
        data.coveragePackedBuffer,
        numCoverageBins,
        data.coverageMaxDepth,
      )
      r.maxDepth = data.coverageMaxDepth
      r.binSize = 1
    }

    uploadSnpCoverage(
      this.hal,
      displayedRegionIndex,
      data.snpPackedBuffer,
      data.snpPositions.length,
    )

    uploadNoncov(
      this.hal,
      displayedRegionIndex,
      data.noncovPackedBuffer,
      data.noncovPositions.length,
    )
    if (data.noncovPositions.length > 0) {
      r.noncovMaxCount = data.noncovMaxCount
    }

    uploadIndicators(
      this.hal,
      displayedRegionIndex,
      data.indicatorPackedBuffer,
      data.indicatorPositions.length,
    )
  }

  private writeUniforms(state: RenderState, frame: BlockFrame) {
    fillFrameUniforms(this.uF32, this.uU32, this.uI32, state, frame)
    writePaletteToUbo(this.uU32, state.colors, state.arcColorByType)
    if (state.showModifications) {
      const m = state.colors.colorMutedSnpBase
      const grey = normalizedRgbToABGR(m[0], m[1], m[2])
      this.uU32[U.colorBaseA] = grey
      this.uU32[U.colorBaseC] = grey
      this.uU32[U.colorBaseG] = grey
      this.uU32[U.colorBaseT] = grey
    }
    this.hal.writeUniforms(this.uData)
  }

  renderBlocks(blocks: RenderBlock[], state: RenderState) {
    const { canvasWidth, canvasHeight } = state
    const dpr = getDpr()
    const bufH = Math.round(canvasHeight * dpr)
    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    let hasDrawn = false
    for (const block of blocks) {
      const region = this.regions.get(block.displayedRegionIndex)
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

      const pxFromEdge = block.reversed
        ? block.screenEndPx - scissorEnd
        : scissorX - block.screenStartPx
      const clippedBpStart = block.bpRangeX[0] + pxFromEdge * bpPerPx
      const clippedBpEnd = clippedBpStart + scissorW * bpPerPx
      const [bpHi, bpLo] = splitPositionWithFrac(clippedBpStart)
      const frame: BlockFrame = {
        region,
        bpHi,
        bpLo,
        clippedBpStart,
        clippedBpEnd,
        canvasW: scissorW,
        reversed: block.reversed,
      }

      this.writeUniforms(state, frame)

      const mode = state.renderingMode ?? 'pileup'
      const { effectiveArcsHeight, covH } = computeBlockHeights(state)
      const pileupTop = Math.round(state.pileupTopOffset * dpr)
      const pileupH = Math.max(0, bufH - pileupTop)

      const vpX = Math.round(scissorX * dpr)
      const vpW = Math.round(scissorW * dpr)
      this.hal.setViewport(vpX, 0, vpW, bufH)
      this.hal.setScissor(vpX, 0, vpW, bufH)

      if (state.showCoverage) {
        this.hal.drawPass(PASS_COVERAGE, block.displayedRegionIndex)
        this.hal.drawPass(PASS_SNP_COV, block.displayedRegionIndex)
        this.hal.drawPass(PASS_MOD_COV, block.displayedRegionIndex)
        this.hal.drawPass(PASS_NONCOV, block.displayedRegionIndex)
        this.hal.drawPass(PASS_INDICATOR, block.displayedRegionIndex)
      }

      if (effectiveArcsHeight > 0 && !state.pairedArcsDown && covH > 0) {
        const arcCovH = covH - state.coverageYOffset
        this.drawArcsPass(
          block,
          region,
          state,
          scissorX,
          scissorW,
          0,
          dpr,
          bufH,
          arcCovH,
        )
      }

      if (pileupH > 0) {
        this.hal.setScissor(vpX, pileupTop, vpW, pileupH)
      }

      if (mode === 'linkedRead') {
        this.hal.drawPass(PASS_CONN_LINE, block.displayedRegionIndex)
      } else if (mode === 'linkedReadBezier') {
        this.hal.drawPass(PASS_LINKED_READ_LINE, block.displayedRegionIndex)
      }
      this.hal.drawPass(PASS_READ, block.displayedRegionIndex)

      if (state.showMismatches) {
        this.hal.drawPass(PASS_GAP, block.displayedRegionIndex)
        this.hal.drawPass(PASS_MISMATCH, block.displayedRegionIndex)
        this.hal.drawPass(PASS_INSERTION, block.displayedRegionIndex)
      }

      this.hal.drawPass(PASS_CLIP, block.displayedRegionIndex)
      if (state.showSoftClipping) {
        this.hal.drawPass(PASS_SOFTCLIP_BASES, block.displayedRegionIndex)
      }

      if (state.showModifications) {
        this.hal.drawPass(PASS_MOD, block.displayedRegionIndex)
      }

      this.renderFeatureOverlays(
        block,
        state,
        frame,
        scissorX,
        scissorW,
        bufH,
        pileupTop,
        pileupH,
        dpr,
      )

      if (effectiveArcsHeight > 0 && state.pairedArcsDown) {
        this.drawArcsPass(
          block,
          region,
          state,
          scissorX,
          scissorW,
          covH,
          dpr,
          bufH,
          effectiveArcsHeight,
        )
      }

      hasDrawn = true
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
    this.hal.deleteRegion(OVERLAY_REGION)

    if (!hasDrawn) {
      this.hal.beginFrame(0, 0, 0, 0)
      this.hal.endFrame()
    }
    return hasDrawn
  }

  private drawArcsPass(
    block: RenderBlock,
    region: LocalRegion,
    state: RenderState,
    scissorX: number,
    scissorW: number,
    arcTop: number,
    dpr: number,
    bufH: number,
    effectiveArcsHeight: number,
  ) {
    const arcViewportTop = Math.round(arcTop * dpr)
    const arcViewportH = Math.min(
      Math.round(effectiveArcsHeight * dpr),
      Math.max(0, bufH - arcViewportTop),
    )
    if (arcViewportH <= 0) {
      return
    }
    const savedUBO = this.uData.slice(0)
    fillArcUniforms(this.uF32, this.uU32, {
      region,
      block,
      state,
      scissorX,
      scissorW,
      arcViewportH,
      dpr,
      covOffset: arcTop === 0 ? effectiveArcsHeight : 0,
    })
    this.hal.writeUniforms(this.uData)

    const vpX = Math.round(scissorX * dpr)
    const vpW = Math.round(scissorW * dpr)
    this.hal.setViewport(vpX, arcViewportTop, vpW, arcViewportH)
    this.hal.setScissor(vpX, arcViewportTop, vpW, arcViewportH)

    this.hal.drawPass(PASS_ARC, block.displayedRegionIndex)
    this.hal.drawPass(PASS_ARC_LINE, block.displayedRegionIndex)

    this.uF32.set(new Float32Array(savedUBO))
    this.hal.setViewport(vpX, 0, vpW, bufH)
    this.hal.writeUniforms(this.uData)
  }

  private renderFeatureOverlays(
    block: RenderBlock,
    state: RenderState,
    frame: BlockFrame,
    scissorX: number,
    scissorW: number,
    bufH: number,
    pileupTop: number,
    pileupH: number,
    dpr: number,
  ) {
    const { region, clippedBpStart, clippedBpEnd } = frame
    const bpLen = clippedBpEnd - clippedBpStart
    const regionHighlightIdx = state.highlightedFeatureId
      ? (region.readIdToIndex.get(state.highlightedFeatureId) ?? -1)
      : -1
    const regionSelectIdx = state.selectedFeatureId
      ? (region.readIdToIndex.get(state.selectedFeatureId) ?? -1)
      : -1

    const needsFeatureHighlight =
      state.highlightedChainIds.length === 0 && regionHighlightIdx >= 0
    const needsFeatureSelection =
      state.selectedChainIds.length === 0 && regionSelectIdx >= 0

    const covOff = state.pileupTopOffset
    // Capture per-block transforms so the 3 toClipRect call sites below
    // don't each have to repeat the same 7 uniform-derived args.
    const clipFor = (absStart: number, absEnd: number, y: number) =>
      toClipRect(
        absStart,
        absEnd,
        y,
        state,
        clippedBpStart,
        bpLen,
        covOff,
        state.canvasHeight,
        block.reversed,
      )
    const tx = 4 / scissorW
    const ty = 4 / state.canvasHeight
    // 4 quads forming a 4px-wide selection frame (top + bottom + two sides).
    const pushSelectionFrame = (
      out: number[],
      c: { sx1: number; sx2: number; syTop: number; syBot: number },
    ) => {
      out.push(
        c.sx1,
        c.syTop,
        c.sx2,
        c.syTop - ty,
        0,
        0.722,
        1,
        1,
        c.sx1,
        c.syBot + ty,
        c.sx2,
        c.syBot,
        0,
        0.722,
        1,
        1,
        c.sx1,
        c.syTop,
        c.sx1 + tx,
        c.syBot,
        0,
        0.722,
        1,
        1,
        c.sx2 - tx,
        c.syTop,
        c.sx2,
        c.syBot,
        0,
        0.722,
        1,
        1,
      )
    }

    if (
      (needsFeatureHighlight || needsFeatureSelection) &&
      this.hal.getBufferCount(block.displayedRegionIndex, PASS_READ) > 0
    ) {
      if (needsFeatureHighlight) {
        const savedUBO = this.uData.slice(0)
        this.uI32[U.highlightOnly] = 1
        this.uI32[U.highlightIdx] = regionHighlightIdx
        this.hal.writeUniforms(this.uData)

        const vpX = Math.round(scissorX * dpr)
        const vpW = Math.round(scissorW * dpr)
        this.hal.setViewport(vpX, 0, vpW, bufH)
        this.hal.setScissor(vpX, pileupTop, vpW, pileupH)
        this.hal.drawPass(PASS_READ, block.displayedRegionIndex)

        this.uF32.set(new Float32Array(savedUBO))
        this.hal.writeUniforms(this.uData)
      }

      if (needsFeatureSelection) {
        const idx = regionSelectIdx
        const clip = clipFor(
          region.readPositions[idx * 2]!,
          region.readPositions[idx * 2 + 1]!,
          region.readYs[idx]!,
        )
        const frame: number[] = []
        pushSelectionFrame(frame, clip)
        this.drawOverlayQuads(
          new Float32Array(frame),
          4,
          scissorX,
          scissorW,
          pileupTop,
          pileupH,
          bufH,
          dpr,
        )
      }
    }

    const quads: number[] = []

    if (state.highlightedChainIds.length > 0) {
      const bounds = getChainBounds(state.highlightedChainIds, region)
      if (bounds) {
        const clip = clipFor(bounds.minStart, bounds.maxEnd, bounds.y)
        quads.push(clip.sx1, clip.syTop, clip.sx2, clip.syBot, 0, 0, 0, 0.4)
      }
    }

    if (state.selectedChainIds.length > 0) {
      const bounds = getChainBounds(state.selectedChainIds, region)
      if (bounds) {
        pushSelectionFrame(
          quads,
          clipFor(bounds.minStart, bounds.maxEnd, bounds.y),
        )
      }
    }

    if (quads.length > 0) {
      this.drawOverlayQuads(
        new Float32Array(quads),
        quads.length / 8,
        scissorX,
        scissorW,
        pileupTop,
        pileupH,
        bufH,
        dpr,
      )
    }
  }

  private drawOverlayQuads(
    quads: Float32Array,
    count: number,
    scissorX: number,
    scissorW: number,
    pileupTop: number,
    pileupH: number,
    bufH: number,
    dpr: number,
  ) {
    this.hal.uploadBuffer(
      OVERLAY_REGION,
      PASS_FLAT_QUAD,
      quads.buffer as ArrayBuffer,
      count,
    )
    const vpX = Math.round(scissorX * dpr)
    const vpW = Math.round(scissorW * dpr)
    this.hal.setViewport(vpX, 0, vpW, bufH)
    this.hal.setScissor(vpX, pileupTop, vpW, pileupH)
    this.hal.drawPass(PASS_FLAT_QUAD, OVERLAY_REGION)
  }

  dispose() {
    for (const key of this.regions.keys()) {
      this.hal.deleteRegion(key)
    }
    this.regions.clear()
    this.hal.dispose()
  }
}
