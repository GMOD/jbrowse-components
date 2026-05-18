import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/maf.generated.ts'

import type { MafBlock } from './mafBackendTypes.ts'

// Pack RGBA (0-255 each) into a single ABGR uint32. Shader unpacks via
// unpackRGBA (see colorPack.slang).
function packRGBA(r: number, g: number, b: number, a = 255): number {
  return ((a & 0xff) * 0x1000000) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)
}

function hexToPackedRGBA(css: string): number {
  const hex = css.startsWith('#') ? css.slice(1) : css
  if (hex.length === 3) {
    const r = parseInt(hex[0]! + hex[0]!, 16)
    const g = parseInt(hex[1]! + hex[1]!, 16)
    const b = parseInt(hex[2]! + hex[2]!, 16)
    return packRGBA(r, g, b)
  }
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return packRGBA(r, g, b)
}

const colorCache = new Map<string, number>()

function resolveColor(css: string): number {
  let packed = colorCache.get(css)
  if (packed === undefined) {
    packed = hexToPackedRGBA(css)
    colorCache.set(css, packed)
  }
  return packed
}

const MATCH_COLOR = packRGBA(200, 200, 200) // lightgrey for matches
const GAP_COLOR = packRGBA(30, 30, 30) // dark for gaps

export interface BuildInstancesArgs {
  blocks: MafBlock[]
  colorForBase: Record<string, string>
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
 * `installMafLifecycle`'s per-region autorun) so theme / setting changes
 * re-encode without an RPC roundtrip — and merging is by *resolved color*,
 * which keeps the quad count proportional to color transitions, not bases.
 *
 * One region may contain multiple disjoint blocks; runs from all blocks
 * concatenate into a single flat instance buffer. Output positions are
 * absolute genomic uint32.
 */
export function buildInstanceBuffer(args: BuildInstancesArgs): {
  buffer: ArrayBuffer
  count: number
} {
  const { blocks, colorForBase, showAllLetters, mismatchRendering } = args
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

      const flushRun = (endBp: number) => {
        if (inRun && runStartBp < endBp) {
          runs.push({ startBp: runStartBp, endBp, rowIndex, color: runColor })
        }
        inRun = false
      }

      for (let i = 0; i < len; i++) {
        // Lowercase compare so case-insensitive matches work and the
        // lowercase-keyed colorForBase lookup hits.
        const refChar = String.fromCharCode(refSeqBytes[i]!).toLowerCase()
        const alnChar = String.fromCharCode(alignmentBytes[i]!).toLowerCase()

        if (refChar === '-') {
          // Reference insertion: not rendered as a base cell.
          flushRun(startBp + genomicOffset)
          continue
        }

        const bpPos = startBp + genomicOffset

        if (alnChar === '-' || alnChar === ' ') {
          flushRun(bpPos)
          runs.push({ startBp: bpPos, endBp: bpPos + 1, rowIndex, color: GAP_COLOR })
          genomicOffset++
          continue
        }

        const isMatch = alnChar === refChar
        let color: number
        if (isMatch && !showAllLetters) {
          color = MATCH_COLOR
        } else {
          const css = colorForBase[alnChar] ?? '#cccccc'
          color = resolveColor(css)
          if (!isMatch && !mismatchRendering) {
            color = resolveColor('#ff8800')
          }
        }

        if (inRun && color === runColor) {
          // Extend current run.
        } else {
          flushRun(bpPos)
          runStartBp = bpPos
          runColor = color
          inRun = true
        }
        genomicOffset++
      }
      flushRun(startBp + genomicOffset)
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
