import { buildColumnForGenomicOffset } from './binning.ts'
import { resolvedExtent } from './rendering/alignedExtent.ts'
import { makeRowFlank } from './rendering/rowFlank.ts'
import {
  packMafCellColorConfig,
  resolveCellPacked,
} from './resolveCellColor.ts'
import {
  INSTANCE_OFFSET_U32,
  INSTANCE_STRIDE_WORDS,
} from './shaders/maf.iface.generated.ts'

import type { MafBlock } from './mafRenderingBackendTypes.ts'
import type { MafColorPalette } from './util.ts'

export interface BuildInstancesArgs {
  blocks: MafBlock[]
  palette: MafColorPalette
  showAllLetters: boolean
  mismatchRendering: boolean
  /**
   * Genomic bp per emitted cell. `1` encodes every base; larger values decimate
   * to one sample per window. Comes from `encodeBinBp` on the display, which
   * only ever hands us a power of two small enough that a cell is sub-pixel.
   */
  binBp: number
}

/**
 * The most instances an encode can emit: one per sampled window per row, since
 * runs only ever merge. Blocks carry their genomic extent as `endBp - startBp`
 * (see `MafBlock`), so this costs no walk. Used to size the writer up front —
 * it is an upper bound, not an exact count, so the writer still grows if a
 * malformed block ever reports an extent shorter than its reference.
 */
function maxInstances(blocks: MafBlock[], binBp: number) {
  let total = 0
  for (const block of blocks) {
    total +=
      Math.ceil((block.endBp - block.startBp) / binBp) * block.rows.length
  }
  return total
}

/**
 * Appends packed instances into a `Uint32Array`. Writing the packed form
 * directly is ~3x faster than collecting `{startBp, endBp, rowIndex, color}`
 * objects and packing them in a second pass, which is worth the small amount of
 * machinery here: a wide MAF region emits over a million runs, and this runs on
 * the *main thread*.
 *
 * Seeded with `maxInstances` so the common path allocates exactly once; the
 * doubling below is a correctness backstop, not the expected route.
 */
class InstanceWriter {
  private u32: Uint32Array
  private capacity: number
  count = 0

  constructor(initialCapacity: number) {
    this.capacity = Math.max(1, initialCapacity)
    this.u32 = new Uint32Array(this.capacity * INSTANCE_STRIDE_WORDS)
  }

  push(startBp: number, endBp: number, rowIndex: number, color: number) {
    if (this.count === this.capacity) {
      this.capacity *= 2
      const next = new Uint32Array(this.capacity * INSTANCE_STRIDE_WORDS)
      next.set(this.u32)
      this.u32 = next
    }
    const base = this.count * INSTANCE_STRIDE_WORDS
    this.u32[base + INSTANCE_OFFSET_U32.startBp] = startBp
    this.u32[base + INSTANCE_OFFSET_U32.endBp] = endBp
    this.u32[base + INSTANCE_OFFSET_U32.rowIndex] = rowIndex
    this.u32[base + INSTANCE_OFFSET_U32.color] = color
    this.count++
  }

  // Right-sized copy rather than a subarray view. A view would pin the whole
  // over-allocation — `maxInstances` bounds windows, but runs merge, so the
  // slack is real — and the encoded payload is retained per region for as long
  // as that region is loaded. One copy of the final buffer is cheap next to
  // holding several MB of dead tail per region for the session.
  finish() {
    return {
      buffer: this.u32.slice(0, this.count * INSTANCE_STRIDE_WORDS),
      count: this.count,
    }
  }
}

/**
 * Encode MAF alignment data into a GPU instance buffer: one quad per run of
 * consecutive same-colored cells, positions as absolute genomic uint32.
 *
 * Runs on the *main thread* (the per-region encode autorun in
 * `LinearMafDisplay`) so theme / setting changes re-encode without an RPC
 * roundtrip. Merging is by *resolved color*, so the quad count tracks color
 * transitions rather than bases.
 *
 * One loop covers both zoom regimes: it steps genomic offsets by `binBp`, so
 * `binBp === 1` visits every base and anything larger samples the first base of
 * each window (see `binning.ts` for why sampling is the right call, and
 * `encodeBinBp` for how the step is chosen). Insertion columns never appear —
 * `colForGpos` holds only columns carrying a genomic position — so the only
 * cells skipped here are the ones outside a row's `resolvedExtent`, which paint
 * blank in both backends.
 */
export function buildInstanceBuffer(args: BuildInstancesArgs) {
  const { blocks, palette, showAllLetters, mismatchRendering, binBp } = args
  // Pack the palette once: per-cell color resolution then reads packed ABGR
  // ints directly with no CSS-string allocation or Map lookups.
  const cfg = packMafCellColorConfig({
    ...palette,
    showAllLetters,
    mismatchRendering,
  })
  const out = new InstanceWriter(maxInstances(blocks, binBp))
  const rowFlank = makeRowFlank(blocks)

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const { startBp, refSeqBytes, rows } = blocks[blockIndex]!
    const { colForGpos, refLen } = buildColumnForGenomicOffset(refSeqBytes)

    for (const row of rows) {
      const { rowIndex, alignmentBytes } = row
      const { firstCol, lastCol } = resolvedExtent(
        alignmentBytes,
        alignmentBytes.length,
        rowFlank(blockIndex, rowIndex),
      )
      // Genomic offset the open run starts at, or -1 for "no run open".
      let runStart = -1
      let runColor = 0
      // Genomic offset just past the last cell visited. Tracked rather than
      // assumed to be `refLen` so a row that stops early closes its run where
      // it actually stopped, and so the merged run ends exactly where the
      // Canvas2D painter's last cell ends.
      let runEnd = 0

      for (let gpos = 0; gpos < refLen; gpos += binBp) {
        const col = colForGpos[gpos]!
        // Malformed files can ship a row shorter than the reference; nothing
        // past its end is classifiable.
        if (col >= alignmentBytes.length) {
          break
        }
        if (col < firstCol || col > lastCol) {
          // Outside the row's aligned extent nothing paints, so close the open
          // run here rather than letting it span the blank.
          if (runStart >= 0) {
            out.push(startBp + runStart, startBp + runEnd, rowIndex, runColor)
            runStart = -1
          }
        } else {
          runEnd = Math.min(gpos + binBp, refLen)
          const color = resolveCellPacked(
            refSeqBytes[col]!,
            alignmentBytes[col]!,
            cfg,
          )
          if (runStart < 0) {
            runStart = gpos
            runColor = color
          } else if (color !== runColor) {
            out.push(startBp + runStart, startBp + gpos, rowIndex, runColor)
            runStart = gpos
            runColor = color
          }
        }
      }
      if (runStart >= 0) {
        out.push(startBp + runStart, startBp + runEnd, rowIndex, runColor)
      }
    }
  }

  return out.finish()
}
