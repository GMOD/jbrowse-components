import {
  clipBlockForCanvas,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import { DASH, LOWER_BIT, SPACE } from '../../util/asciiBytes.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const N_UPPER = 78 // 'N'

// Overlay opacity for the heatmap: low enough that the base coloring (and any
// letters drawn on top) stay legible, high enough to read the conservation
// pattern at a glance. Shared by the on-screen canvas and SVG export.
export const ROW_IDENTITY_HEATMAP_ALPHA = 0.6

interface DrawRowIdentityState {
  rowHeight: number
  rowProportion: number
  /** display row count (sizes the per-row accumulators) */
  nRows: number
  canvasWidth: number
  /** 0..1 overlay opacity (lets the base coloring show through) */
  alpha: number
}

/**
 * RdYlGn-style identity ramp: divergent (0) → intermediate (0.5) → conserved
 * (1), returned as an `[r,g,b]` triple. Endpoints are the standard RdYlGn
 * diverging colormap, so the heatmap reads the same way as common MSA
 * percent-identity shadings. Pure so it can be unit-tested independent of any
 * canvas.
 */
export function identityColor(t: number): [number, number, number] {
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  const lerp = (a: number, b: number, f: number) => Math.round(a + (b - a) * f)
  if (c < 0.5) {
    const f = c / 0.5
    return [lerp(215, 255, f), lerp(48, 255, f), lerp(39, 191, f)]
  }
  const f = (c - 0.5) / 0.5
  return [lerp(255, 26, f), lerp(255, 152, f), lerp(191, 80, f)]
}

/**
 * Splat one row's per-bp match / classifiable counts into per-pixel
 * accumulators, comparing each sample base to the reference exactly as
 * `computeMafCoverage` does: reference-relative insertion columns (ref `-`)
 * occupy no ref position and are skipped; a known ref base with a non-gap
 * sample base is classifiable, and an uppercased exact match scores. Each
 * reference base paints every pixel its `[bpToX(bp), bpToX(bp+1)]` span covers,
 * so `matchSum[x]/classCount[x]` is that row's mean identity under pixel `x` —
 * one pixel's worth of bp is the sliding window (same semantics as the
 * conservation band). Pure + accumulator-mutating for unit testing.
 */
export function accumulateRowIdentity(
  matchSum: Float32Array,
  classCount: Float32Array,
  refBytes: Uint8Array,
  alignmentBytes: Uint8Array,
  startBp: number,
  bpToX: (bp: number) => number,
  width: number,
) {
  let refPos = startBp
  for (let col = 0; col < refBytes.length; col++) {
    const refByte = refBytes[col]!
    if (refByte !== DASH) {
      const refUpper = refByte & ~LOWER_BIT
      const sampleByte = alignmentBytes[col]!
      const classifiable =
        refUpper !== N_UPPER && sampleByte !== DASH && sampleByte !== SPACE
      if (classifiable) {
        const xa = bpToX(refPos)
        const xb = bpToX(refPos + 1)
        let lo = Math.floor(Math.min(xa, xb))
        let hi = Math.max(lo + 1, Math.ceil(Math.max(xa, xb)))
        if (lo < 0) {
          lo = 0
        }
        if (hi > width) {
          hi = width
        }
        const isMatch = (sampleByte & ~LOWER_BIT) === refUpper
        for (let px = lo; px < hi; px++) {
          classCount[px]! += 1
          if (isMatch) {
            matchSum[px]! += 1
          }
        }
      }
      refPos++
    }
  }
}

/**
 * Draw the per-row identity heatmap: each species row is shaded by its local
 * (per-pixel) percent identity to the reference, on a divergent→conserved
 * ramp. Computed on the main thread from the already-fetched alignment bytes
 * (`MafBlock.rows`) — no extra worker payload — keyed to the row geometry the
 * GPU base canvas uses. Drawn at `alpha` over that canvas so divergent stretches
 * stand out while the underlying bases stay legible. Pixels with no
 * classifiable base (gap / ref `N`) are left untouched. The reference row is
 * not special-cased: it compares equal to itself and reads fully conserved,
 * which is the expected visual anchor (unlike the row-label policy, which
 * suppresses its trivial 100%). Shared by the on-screen canvas and SVG export,
 * like `drawConservation`.
 */
export function drawRowIdentityHeatmap(
  ctx: Ctx2D,
  blocks: RenderBlock[],
  regions: ReadonlyMap<number, MafRegionData>,
  state: DrawRowIdentityState,
) {
  const { rowHeight, rowProportion, nRows, canvasWidth, alpha } = state
  const width = Math.ceil(canvasWidth)
  if (width <= 0 || nRows <= 0) {
    return
  }
  // Per-row × per-pixel accumulators, flattened (row r occupies [r*width,
  // (r+1)*width)). One pass over the visible blocks fills them; a single fill
  // pass below colors each row band.
  const matchSum = new Float32Array(nRows * width)
  const classCount = new Float32Array(nRows * width)
  for (const block of blocks) {
    const region = regions.get(block.displayedRegionIndex)
    const clip = region ? clipBlockForCanvas(block, canvasWidth) : null
    if (region && clip) {
      const bpToX = makeBpMapper(block)
      for (const mafBlock of region.blocks) {
        for (const row of mafBlock.rows) {
          if (row.rowIndex < nRows) {
            const base = row.rowIndex * width
            accumulateRowIdentity(
              matchSum.subarray(base, base + width),
              classCount.subarray(base, base + width),
              mafBlock.refSeqBytes,
              row.alignmentBytes,
              mafBlock.startBp,
              bpToX,
              width,
            )
          }
        }
      }
    }
  }

  // Precompute the 101 ramp colors (0..100%) as alpha-baked rgba strings once
  // per draw — bounds string allocation regardless of pixel × row count, and
  // SvgCanvas has no globalAlpha so the alpha must live in the fillStyle.
  const lut = Array.from({ length: 101 }, (_, i) => {
    const [r, g, b] = identityColor(i / 100)
    return `rgba(${r},${g},${b},${alpha})`
  })
  const bandH = rowHeight * rowProportion
  const bandOffset = (rowHeight - bandH) / 2
  for (let r = 0; r < nRows; r++) {
    const rowTop = bandOffset + rowHeight * r
    const base = r * width
    for (let x = 0; x < width; x++) {
      const c = classCount[base + x]!
      if (c > 0) {
        ctx.fillStyle = lut[Math.round((matchSum[base + x]! / c) * 100)]!
        ctx.fillRect(x, rowTop, 1, bandH)
      }
    }
  }
}
