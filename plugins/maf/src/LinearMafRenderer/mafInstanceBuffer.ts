import {
  RESOLVE_PACKED_SKIP,
  packMafCellColorConfig,
  resolveCellPacked,
} from './resolveCellColor.ts'
import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/maf.generated.ts'

import type { MafBlock } from './mafRenderingBackendTypes.ts'
import type { MafColorPalette } from './util.ts'

export interface BuildInstancesArgs {
  blocks: MafBlock[]
  palette: MafColorPalette
  showAllLetters: boolean
  mismatchRendering: boolean
}

interface Run {
  startBp: number
  endBp: number
  rowIndex: number
  color: number
}

/**
 * Encode MAF alignment data into a GPU instance buffer. One quad per run
 * of consecutive same-colored cells. Runs on the *main thread* (see
 * the per-region encode autorun in `LinearMafDisplay`) so theme / setting changes
 * re-encode without an RPC roundtrip — and merging is by *resolved color*,
 * which keeps the quad count proportional to color transitions, not to
 * bases.
 *
 * One region may contain multiple disjoint blocks; runs from all blocks
 * concatenate into a single flat buffer. Output positions are absolute
 * genomic uint32.
 */
export function buildInstanceBuffer(args: BuildInstancesArgs): {
  buffer: ArrayBuffer
  count: number
} {
  const { blocks, palette, showAllLetters, mismatchRendering } = args
  // Pack the palette once: per-cell color resolution then reads packed ABGR
  // ints directly with no CSS-string allocation or Map lookups.
  const cfg = packMafCellColorConfig({
    ...palette,
    showAllLetters,
    mismatchRendering,
  })
  const runs: Run[] = []

  for (const block of blocks) {
    const { startBp, refSeqBytes, rows } = block
    for (const row of rows) {
      const { rowIndex, alignmentBytes } = row
      const len = Math.min(alignmentBytes.length, refSeqBytes.length)

      let runStartBp = 0
      let runColor = 0
      let inRun = false
      let genomicOffset = 0

      for (let i = 0; i < len; i++) {
        const color = resolveCellPacked(
          refSeqBytes[i]!,
          alignmentBytes[i]!,
          cfg,
        )
        if (color === RESOLVE_PACKED_SKIP) {
          // Reference insertion: not rendered as a base cell.
          if (inRun) {
            runs.push({
              startBp: runStartBp,
              endBp: startBp + genomicOffset,
              rowIndex,
              color: runColor,
            })
            inRun = false
          }
          continue
        }
        const bpPos = startBp + genomicOffset
        if (inRun && color === runColor) {
          // Extend current run.
        } else {
          if (inRun) {
            runs.push({
              startBp: runStartBp,
              endBp: bpPos,
              rowIndex,
              color: runColor,
            })
          }
          runStartBp = bpPos
          runColor = color
          inRun = true
        }
        genomicOffset++
      }
      if (inRun) {
        runs.push({
          startBp: runStartBp,
          endBp: startBp + genomicOffset,
          rowIndex,
          color: runColor,
        })
      }
    }
  }

  const count = runs.length
  const buffer = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const r = runs[i]!
    const base = i * INSTANCE_STRIDE_F32
    u32[base + FIELD_OFFSET_F32.startBp] = r.startBp
    u32[base + FIELD_OFFSET_F32.endBp] = r.endBp
    u32[base + FIELD_OFFSET_F32.rowIndex] = r.rowIndex
    u32[base + FIELD_OFFSET_F32.color] = r.color
  }
  return { buffer, count }
}
