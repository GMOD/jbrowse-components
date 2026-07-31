import {
  clipBlockForCanvas,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import { DASH, LOWER_BIT, N_UPPER, SPACE } from '../../util/asciiBytes.ts'
import { rowBandGeometry, visibleRowRange } from './visibleRegionGeometry.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { RowIdentityMode } from '../rowIdentityModes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

interface DrawRowIdentityState {
  rowHeight: number
  rowProportion: number
  /** display row count */
  nRows: number
  canvasWidth: number
  /** the rows viewport (the canvas), which with `scrollTop` picks the rows drawn */
  canvasHeight: number
  scrollTop: number
  /** `heatmap` shades each cell on a ramp; `xyplot` draws an identity wiggle */
  mode: RowIdentityMode
}

/**
 * Diverging red→grey→blue identity ramp: divergent (0) → neutral (0.5) →
 * conserved (1), returned as an `[r,g,b]` triple. Grey neutral midpoint (rather
 * than the white of a sequential density ramp) keeps low-identity bases visible
 * while reserving the saturated blue end for the conserved positions that
 * matter. Pure so it can be unit-tested independent of any canvas.
 */
export function identityColor(t: number): [number, number, number] {
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  const lerp = (a: number, b: number, f: number) => Math.round(a + (b - a) * f)
  if (c < 0.5) {
    const f = c / 0.5
    return [lerp(199, 140, f), lerp(67, 140, f), lerp(56, 140, f)]
  }
  const f = (c - 0.5) / 0.5
  return [lerp(140, 47, f), lerp(140, 102, f), lerp(140, 176, f)]
}

/** `identityColor` as a CSS string, for the legend swatches. */
export function identityRgb(t: number) {
  const [r, g, b] = identityColor(t)
  return `rgb(${r},${g},${b})`
}

// The 101 ramp colors (0..100%) the heatmap fills with, quantized so the fill
// loop never allocates a string. The ramp is a pure function of the fraction,
// so this is module-level rather than per-draw: it was being rebuilt on every
// pan and zoom, for a value that can't change.
const IDENTITY_RAMP = Array.from({ length: 101 }, (_, i) =>
  identityRgb(i / 100),
)

/**
 * One block's reference-side decisions, computed once and replayed for every
 * row: which column carries each classifiable genomic position, its uppercased
 * reference base, and the pixel span that position paints.
 *
 * Splitting this out of the per-row walk is what keeps the pass affordable, and
 * it removes two different kinds of repeated work:
 *
 * - The reference decisions are row-independent — the gap test, the `N` test,
 *   the two `bpToX` calls and the floor/ceil clamp — so doing them inside the
 *   row loop repeated all of it once per species.
 * - Columns whose pixel span falls outside `[xLo, xHi)` contribute nothing, and
 *   there are a lot of them: the fetched region is the *buffered* one (half a
 *   screen each side), so roughly half of a region's columns are off-block. The
 *   row loop used to pay for those before the clamp discarded them; dropping
 *   them here means it never sees them.
 *
 * Buffers are reused across blocks rather than allocated per block. Real MAF is
 * many small blocks — UCSC ce11 26-way has a median block of 7bp — and at that
 * shape a fresh set per block just trades the walk for allocation churn: at 48k
 * blocks reuse measured 2.4x over the old code against 1.5x for per-block
 * allocation, and the two are equivalent when blocks are few and large.
 *
 * Same growable-typed-array shape as `InstanceWriter` in `mafInstanceBuffer.ts`,
 * and for the same reason — a per-frame main-thread path that must not allocate
 * per item.
 */
export class IdentityColumns {
  private cols = new Uint32Array(0)
  private refUppers = new Uint8Array(0)
  private los = new Int32Array(0)
  private his = new Int32Array(0)
  private count = 0

  /**
   * `[xLo, xHi)` is the block's own pixel span (`clip.scissorX` ..
   * `+scissorW`), NOT the whole canvas — see `accumulateConservation` for why.
   */
  build(
    refBytes: Uint8Array,
    startBp: number,
    bpToX: (bp: number) => number,
    xLo: number,
    xHi: number,
  ) {
    const n = refBytes.length
    if (this.cols.length < n) {
      this.cols = new Uint32Array(n)
      this.refUppers = new Uint8Array(n)
      this.los = new Int32Array(n)
      this.his = new Int32Array(n)
    }
    let count = 0
    let refPos = startBp
    for (let col = 0; col < n; col++) {
      const refByte = refBytes[col]!
      if (refByte !== DASH) {
        const refUpper = refByte & ~LOWER_BIT
        if (refUpper !== N_UPPER) {
          const xa = bpToX(refPos)
          const xb = bpToX(refPos + 1)
          const cellLeft = Math.floor(Math.min(xa, xb))
          const lo = Math.max(xLo, cellLeft)
          const hi = Math.min(
            xHi,
            Math.max(cellLeft + 1, Math.ceil(Math.max(xa, xb))),
          )
          if (hi > lo) {
            this.cols[count] = col
            this.refUppers[count] = refUpper
            this.los[count] = lo
            this.his[count] = hi
            count++
          }
        }
        refPos++
      }
    }
    this.count = count
  }

  /**
   * Splat one row's match / classifiable counts into the per-pixel
   * accumulators, comparing each sample base to the reference exactly as
   * `computeMafCoverage` does: a non-gap sample base under a known reference
   * base is classifiable, and an uppercased exact match scores. So
   * `matchSum[x]/classCount[x]` is that row's mean identity under pixel `x` —
   * one pixel's worth of bp is the sliding window (same semantics as the
   * conservation band).
   *
   * The accumulators are the caller's whole flattened row-major buffers and
   * `rowBase` is this row's offset into them, rather than a per-row `subarray`
   * view: this runs once per row per block per frame, and the two views were the
   * only allocation in the pass.
   */
  accumulate(
    matchSum: Float32Array,
    classCount: Float32Array,
    rowBase: number,
    alignmentBytes: Uint8Array,
  ) {
    const { cols, refUppers, los, his, count } = this
    const rowLen = alignmentBytes.length
    for (let i = 0; i < count; i++) {
      const col = cols[i]!
      // Malformed files can ship a row shorter than the reference; nothing past
      // its end is classifiable. Both base-cell painters already stop there
      // (`renderBases`, `buildInstanceBuffer`) — without this the missing tail
      // read as a mismatch at every column, so a truncated row drew as 0%
      // identity instead of as absent.
      if (col >= rowLen) {
        break
      }
      const sampleByte = alignmentBytes[col]!
      if (sampleByte !== DASH && sampleByte !== SPACE) {
        const isMatch = (sampleByte & ~LOWER_BIT) === refUppers[i]!
        const hi = his[i]!
        for (let px = los[i]!; px < hi; px++) {
          classCount[rowBase + px]! += 1
          if (isMatch) {
            matchSum[rowBase + px]! += 1
          }
        }
      }
    }
  }
}

/**
 * Draw the per-row identity overlay: each species row shows its local
 * (per-pixel) percent identity to the reference, computed on the main thread
 * from the already-fetched alignment bytes (`MafBlock.rows`) — no extra worker
 * payload — keyed to the row geometry the GPU base canvas uses. Two modes:
 *
 * - `heatmap` shades the whole row band on a red→grey→blue ramp.
 * - `xyplot` draws an identity wiggle: a conserved-blue bar per pixel whose
 *   height is that pixel's identity (taller = more conserved), like the
 *   conservation band but one track per species — emulates the UCSC multiz
 *   per-species pairwise "alignment quality" wiggle.
 *
 * This replaces the base SNP rendering when active (zoomed out past base
 * level — see `activeRowRendering`), so it draws solid; pixels with no
 * classifiable base (gap / ref `N`) are left untouched. The reference row is
 * not special-cased: it compares equal to itself and reads fully conserved, the
 * expected visual anchor. Shared by the on-screen canvas and SVG export, like
 * `drawConservation`.
 */
export function drawRowIdentity(
  ctx: Ctx2D,
  blocks: RenderBlock[],
  regions: ReadonlyMap<number, MafRegionData>,
  state: DrawRowIdentityState,
) {
  const {
    rowHeight,
    rowProportion,
    nRows,
    canvasWidth,
    canvasHeight,
    scrollTop,
    mode,
  } = state
  const width = Math.ceil(canvasWidth)
  if (width <= 0 || nRows <= 0) {
    return
  }
  // Only the rows on screen are accumulated and drawn — the rest are scrolled
  // past, and with a pinned row height there can be many screens of them.
  const { firstRow, endRow } = visibleRowRange(
    rowHeight,
    scrollTop,
    canvasHeight,
  )
  const lastRow = Math.min(endRow, nRows)
  // Per-*visible*-row × per-pixel accumulators, flattened (visible row r
  // occupies [(r-firstRow)*width, (r-firstRow+1)*width)). One pass over the
  // visible blocks fills them; a single fill pass below colors each row band.
  const drawnRows = Math.max(0, lastRow - firstRow)
  const matchSum = new Float32Array(drawnRows * width)
  const classCount = new Float32Array(drawnRows * width)
  // One set of column buffers for the whole pass, rebuilt per block.
  const columns = new IdentityColumns()
  for (const block of blocks) {
    const region = regions.get(block.displayedRegionIndex)
    const clip = region ? clipBlockForCanvas(block, canvasWidth) : null
    if (region && clip) {
      const bpToX = makeBpMapper(block)
      for (const mafBlock of region.blocks) {
        columns.build(
          mafBlock.refSeqBytes,
          mafBlock.startBp,
          bpToX,
          clip.scissorX,
          clip.scissorX + clip.scissorW,
        )
        for (const row of mafBlock.rows) {
          if (row.rowIndex >= firstRow && row.rowIndex < lastRow) {
            columns.accumulate(
              matchSum,
              classCount,
              (row.rowIndex - firstRow) * width,
              row.alignmentBytes,
            )
          }
        }
      }
    }
  }

  const { h: bandH, offset: bandOffset } = rowBandGeometry(
    rowHeight,
    rowProportion,
    scrollTop,
  )
  if (mode === 'xyplot') {
    ctx.fillStyle = IDENTITY_RAMP[100]!
    for (let row = firstRow; row < lastRow; row++) {
      const rowBottom = bandOffset + rowHeight * row + bandH
      const base = (row - firstRow) * width
      for (let x = 0; x < width; x++) {
        const c = classCount[base + x]!
        if (c > 0) {
          const h = (matchSum[base + x]! / c) * bandH
          ctx.fillRect(x, rowBottom - h, 1, h)
        }
      }
    }
  } else {
    for (let row = firstRow; row < lastRow; row++) {
      const rowTop = bandOffset + rowHeight * row
      const base = (row - firstRow) * width
      for (let x = 0; x < width; x++) {
        const c = classCount[base + x]!
        if (c > 0) {
          ctx.fillStyle =
            IDENTITY_RAMP[Math.round((matchSum[base + x]! / c) * 100)]!
          ctx.fillRect(x, rowTop, 1, bandH)
        }
      }
    }
  }
}
