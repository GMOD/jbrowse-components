// One synthetic alignment written out as the decompressed text of a `.tai`
// slice, both as MAF and as TAF, for the `.tai` readers' benches.
import { mulberry32 } from './mafTabixFixture.ts'

export interface TaiSliceSpec {
  species: number
  columns: number
  blocks: number
  /** reference distance from one block's start to the next */
  spacing: number
  /** the blocks the query covers, as [first, last) */
  queryBlocks: [number, number]
  seed: number
}

const BASES = 'ACGT'
const SRC_SIZE = 100_000_000
const FIRST_START = 1000

const blockStart = (spec: TaiSliceSpec, block: number) =>
  FIRST_START + block * spec.spacing

/** The query a region of `queryBlocks` asks the reader for. */
export function sliceQuery(spec: TaiSliceSpec) {
  const [first, last] = spec.queryBlocks
  return {
    refName: 'chr1',
    start: blockStart(spec, first),
    end: blockStart(spec, last),
  }
}

/**
 * Each block's rows as aligned text: the reference has no gaps, every other
 * row 5% dashes and divergence graded 2-20% across the species, and each row's
 * start follows on from its last block's aligned bases, as TAF's coordinate
 * chain states it.
 */
function alignmentBlocks(spec: TaiSliceSpec) {
  const rand = mulberry32(spec.seed)
  const starts = Array.from({ length: spec.species }, () => FIRST_START)
  const blocks: { start: number; size: number; text: string }[][] = []
  for (let b = 0; b < spec.blocks; b++) {
    let ref = ''
    for (let c = 0; c < spec.columns; c++) {
      ref += BASES[Math.floor(rand() * 4)]
    }
    const rows = []
    for (let s = 0; s < spec.species; s++) {
      const divergence = 0.02 + (0.18 * s) / Math.max(1, spec.species - 1)
      let text = ''
      let size = 0
      for (let c = 0; c < spec.columns; c++) {
        const gap = s > 0 && rand() < 0.05
        text += gap
          ? '-'
          : s > 0 && rand() < divergence
            ? BASES[Math.floor(rand() * 4)]
            : ref[c]
        size += gap ? 0 : 1
      }
      const start = s === 0 ? blockStart(spec, b) : starts[s]!
      rows.push({ start, size, text })
      starts[s] = start + size
    }
    blocks.push(rows)
  }
  return blocks
}

const src = (species: number) => `sp${species}.chr1`

export function mafSliceText(spec: TaiSliceSpec) {
  const lines: string[] = []
  for (const rows of alignmentBlocks(spec)) {
    lines.push('a score=0')
    rows.forEach((row, s) => {
      lines.push(
        `s\t${src(s)}\t${row.start}\t${row.size}\t+\t${SRC_SIZE}\t${row.text}`,
      )
    })
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

export function tafSliceText(spec: TaiSliceSpec) {
  const lines: string[] = []
  alignmentBlocks(spec).forEach((rows, b) => {
    for (let c = 0; c < spec.columns; c++) {
      const column = rows.map(row => row.text[c]).join('')
      const instructions =
        b === 0
          ? rows
              .map((row, s) => `i ${s} ${src(s)} ${row.start} + ${SRC_SIZE}`)
              .join(' ')
          : `g 0 ${spec.spacing - spec.columns}`
      lines.push(c === 0 ? `${column} ; ${instructions}` : column)
    }
  })
  return `${lines.join('\n')}\n`
}
