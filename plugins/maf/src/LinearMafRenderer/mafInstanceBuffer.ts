import { resolveCellColor } from './resolveCellColor.ts'
import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/maf.generated.ts'

import type { MafBlock } from './mafBackendTypes.ts'
import type { MafCellColorConfig } from './resolveCellColor.ts'

// Pack RGBA (0-255 each) into a single ABGR uint32 — the shader unpacks
// via unpackRGBA (see packages/core/src/gpu/shaders/colorPack.slang).
function packRGBA(r: number, g: number, b: number, a = 255): number {
  return ((a & 0xff) * 0x1000000) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)
}

function hexToPackedRGBA(hex: string): number {
  const h = hex.startsWith('#') ? hex.slice(1) : hex
  if (h.length === 3) {
    return packRGBA(
      parseInt(h[0]! + h[0]!, 16),
      parseInt(h[1]! + h[1]!, 16),
      parseInt(h[2]! + h[2]!, 16),
    )
  }
  return packRGBA(
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  )
}

// Memoized resolver. CSS color strings come from a small set (theme bases +
// 4 hardcoded constants), so the cache stays tiny and hot.
const colorCache = new Map<string, number>([
  ['lightgrey', packRGBA(211, 211, 211)],
  ['lightblue', packRGBA(173, 216, 230)],
  ['orange', packRGBA(255, 165, 0)],
  ['black', packRGBA(0, 0, 0)],
])

function cssToPackedABGR(css: string): number {
  let packed = colorCache.get(css)
  if (packed === undefined) {
    packed = hexToPackedRGBA(css)
    colorCache.set(css, packed)
  }
  return packed
}

export interface BuildInstancesArgs extends MafCellColorConfig {
  blocks: MafBlock[]
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
 * `installMafLifecycle`'s per-region autorun) so theme / setting changes
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
  const { blocks, ...cfg } = args
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
        const css = resolveCellColor(refSeqBytes[i]!, alignmentBytes[i]!, cfg)
        if (css === undefined) {
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
        const color = cssToPackedABGR(css)
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
