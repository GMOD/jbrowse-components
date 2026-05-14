import { INSTANCE_STRIDE_U32 } from './shaders/maf.generated.ts'

// Pack RGBA (0-255 each) into a single uint32.
// The shader's unpackRGBA reads R from bits 0-7, G from 8-15, B from 16-23, A from 24-31.
function packRGBA(r: number, g: number, b: number, a = 255): number {
  return ((a & 0xff) * 0x1000000) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)
}

// Parse a CSS hex color (#rrggbb or #rgb) to packed uint32.
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

export function resolveColor(css: string): number {
  let packed = colorCache.get(css)
  if (packed === undefined) {
    packed = hexToPackedRGBA(css)
    colorCache.set(css, packed)
  }
  return packed
}

export const MATCH_COLOR = packRGBA(200, 200, 200)  // light grey for matches
export const GAP_COLOR   = packRGBA(30, 30, 30)     // near-black for gaps

export interface BuildInstancesArgs {
  refSeqBytes: Uint8Array
  rows: { rowIndex: number; alignmentBytes: Uint8Array }[]
  startBp: number
  colorForBase: Record<string, string>
  showAllLetters: boolean
  mismatchRendering: boolean
  showAsUpperCase: boolean
}

interface Run {
  startBp: number
  endBp: number
  rowIndex: number
  color: number
}

/**
 * Encode MAF alignment data into a GPU instance buffer (one quad per color run).
 * Runs of consecutive same-colored bases are merged for efficiency.
 * This runs in the RPC worker — all output is absolute genomic uint32.
 */
export function buildInstanceBuffer(args: BuildInstancesArgs): {
  buffer: ArrayBuffer
  count: number
} {
  const { refSeqBytes, rows, startBp, colorForBase, showAllLetters, mismatchRendering } = args
  const runs: Run[] = []

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
      const refCode = refSeqBytes[i]!
      const alnCode = alignmentBytes[i]!
      const refChar = String.fromCharCode(refCode).toUpperCase()
      const alnChar = String.fromCharCode(alnCode)

      if (refChar === '-') {
        // Insertion in reference: skip (handled separately as insertion markers)
        flushRun(startBp + genomicOffset)
        continue
      }

      const bpPos = startBp + genomicOffset

      if (alnChar === '-' || alnChar === ' ') {
        // Gap in alignment: short black line at mid-height — use a thin run
        flushRun(bpPos)
        runs.push({ startBp: bpPos, endBp: bpPos + 1, rowIndex, color: GAP_COLOR })
        genomicOffset++
        continue
      }

      const alnUp = alnChar.toUpperCase()
      const isMatch = alnUp === refChar

      let color: number
      if (isMatch && !showAllLetters) {
        color = MATCH_COLOR
      } else {
        const css = colorForBase[alnUp] ?? colorForBase.N ?? '#cccccc'
        color = resolveColor(css)
        if (!isMatch && !mismatchRendering) {
          color = resolveColor('#ff8800')
        }
      }

      if (inRun && color === runColor) {
        // Extend current run — no push needed, endBp updated on flush
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

  const count = runs.length
  const buffer = new ArrayBuffer(count * INSTANCE_STRIDE_U32 * 4)
  const u32 = new Uint32Array(buffer)

  for (let i = 0; i < count; i++) {
    const r = runs[i]!
    const base = i * INSTANCE_STRIDE_U32
    u32[base + 0] = r.startBp
    u32[base + 1] = r.endBp
    u32[base + 2] = r.rowIndex
    u32[base + 3] = r.color
  }

  return { buffer, count }
}
