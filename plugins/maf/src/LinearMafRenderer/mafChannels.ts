import { ColumnMapper } from './binning.ts'
import { resolvedExtent } from './rendering/alignedExtent.ts'
import { makeRowFlank } from './rendering/rowFlank.ts'
import {
  packMafCellColorConfig,
  resolveCellPacked,
} from './resolveCellColor.ts'

import type { MafBlock } from './mafRenderingBackendTypes.ts'
import type { MafColorPalette } from './util.ts'
import type { SpanChannels } from '@jbrowse/render-core/marks'

/**
 * What a region encodes to while the rows are drawn somewhere else — the
 * identity plot, the codon view, colour-by-chromosome. Shared rather than
 * allocated per region: nothing writes to it, and an empty pack is how a pass
 * releases its GPU buffer.
 */
export const EMPTY_MAF_CELLS: SpanChannels = {
  x: new Uint32Array(0),
  x2: new Uint32Array(0),
  row: new Uint32Array(0),
  color: new Uint32Array(0),
  count: 0,
}

export interface BuildChannelsArgs {
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
 * (see `MafBlock`), so this costs no walk. Used to size the arrays up front,
 * and it is an upper bound rather than an exact count — hence the trim at the
 * end.
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
 * Encode MAF alignment data into the `span` shape's channels: one instance per
 * run of consecutive same-colored cells, positions as absolute genomic uint32.
 *
 * **This is the single walk both backends draw from** — the GPU packs these
 * channels into the shape's instance buffer, the Canvas2D painter and the SVG
 * export walk them directly. The per-column re-walk the Canvas2D fallback used
 * to do (`drawMafBlocks` + `rendering/bases.ts`) merged the same runs by CSS
 * string instead of packed ABGR, which is why `resolveCellColor` had two
 * flavours and a test sweeping them against each other.
 *
 * Runs on the *main thread* (the per-region encode autorun in
 * `LinearMafDisplay`) so theme / setting changes re-encode without an RPC
 * roundtrip. Merging is by resolved color, so the instance count tracks color
 * transitions rather than bases.
 *
 * One loop covers both zoom regimes: it steps genomic offsets by `binBp`, so
 * `binBp === 1` visits every base and anything larger samples the first base of
 * each window (see `binning.ts` for why sampling is the right call, and
 * `encodeBinBp` for how the step is chosen). Insertion columns never appear —
 * `colForGpos` holds only columns carrying a genomic position — so the only
 * cells skipped here are the ones outside a row's `resolvedExtent`, which paint
 * blank.
 */
export function buildMafChannels(args: BuildChannelsArgs): SpanChannels {
  const { blocks, palette, showAllLetters, mismatchRendering, binBp } = args
  // Pack the palette once: per-cell color resolution then reads packed ABGR
  // ints directly with no CSS-string allocation or Map lookups.
  const cfg = packMafCellColorConfig({
    ...palette,
    showAllLetters,
    mismatchRendering,
  })
  const cap = maxInstances(blocks, binBp)
  const x = new Uint32Array(cap)
  const x2 = new Uint32Array(cap)
  const row = new Uint32Array(cap)
  const color = new Uint32Array(cap)
  let count = 0
  const emit = (
    startBp: number,
    endBp: number,
    rowIndex: number,
    abgr: number,
  ) => {
    x[count] = startBp
    x2[count] = endBp
    row[count] = rowIndex
    color[count] = abgr
    count++
  }
  const rowFlank = makeRowFlank(blocks)
  // One buffer for the whole encode rather than one per block — a real MAF is
  // tens of thousands of small blocks, so the per-block allocation was the
  // encode's only remaining one. See `ColumnMapper`.
  const columns = new ColumnMapper()

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const { startBp, refSeqBytes, rows } = blocks[blockIndex]!
    const { colForGpos, refLen } = columns.build(refSeqBytes)

    for (const rowData of rows) {
      const { rowIndex, alignmentBytes } = rowData
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
      // it actually stopped.
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
            emit(startBp + runStart, startBp + runEnd, rowIndex, runColor)
            runStart = -1
          }
        } else {
          runEnd = Math.min(gpos + binBp, refLen)
          const abgr = resolveCellPacked(
            refSeqBytes[col]!,
            alignmentBytes[col]!,
            cfg,
          )
          if (runStart < 0) {
            runStart = gpos
            runColor = abgr
          } else if (abgr !== runColor) {
            emit(startBp + runStart, startBp + gpos, rowIndex, runColor)
            runStart = gpos
            runColor = abgr
          }
        }
      }
      if (runStart >= 0) {
        emit(startBp + runStart, startBp + runEnd, rowIndex, runColor)
      }
    }
  }

  // Trimmed rather than handed back at capacity: runs merge, so `maxInstances`
  // over-allocates by orders of magnitude on a conserved alignment, and this
  // payload is retained for as long as the region is loaded. A `subarray` would
  // pin the dead tail with it.
  return {
    x: x.slice(0, count),
    x2: x2.slice(0, count),
    row: row.slice(0, count),
    color: color.slice(0, count),
    count,
  }
}
