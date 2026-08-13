import { ColumnMapper } from './binning.ts'
import { resolvedExtent } from './rendering/alignedExtent.ts'
import { makeRowFlank } from './rendering/rowFlank.ts'
import {
  packMafCellColorConfig,
  resolveCellPacked,
} from './resolveCellColor.ts'
import { InstanceWriter } from './shaders/maf.iface.generated.ts'

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
  // One buffer for the whole encode rather than one per block — a real MAF is
  // tens of thousands of small blocks, so the per-block allocation was the
  // encode's only remaining one. See `ColumnMapper`.
  const columns = new ColumnMapper()

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const { startBp, refSeqBytes, rows } = blocks[blockIndex]!
    const { colForGpos, refLen } = columns.build(refSeqBytes)

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

  // A view over the writer's own right-sized buffer, not a copy of it: `finish`
  // has already trimmed the over-allocation `maxInstances` left, so this covers
  // exactly the instances written and pins nothing beyond them. The payload
  // stays a Uint32Array because every MAF consumer reads it as words.
  return { buffer: new Uint32Array(out.finish()), count: out.count }
}
