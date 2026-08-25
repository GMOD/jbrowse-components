import { DASH, SPACE } from '../util/asciiBytes.ts'
import { forwardPos } from './components/findRowHover.ts'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

/**
 * One MAF block of one aligned row, as the synteny feature a `SyntenyTrack`
 * draws: the reference slice it covers, the row's own slice as `mate`, and the
 * CIGAR between them read straight off the alignment columns.
 */
export interface MafRowSyntenyFeature {
  uniqueId: string
  refName: string
  start: number
  end: number
  strand: number
  CIGAR: string
  syntenyId: number
  mate: {
    uniqueId: string
    refName: string
    start: number
    end: number
    assemblyName: string
    syntenyId: number
  }
}

export interface MafRowSynteny {
  features: MafRowSyntenyFeature[]
  // the row's own locus over the whole selection, half-open, forward strand
  refName: string
  start: number
  end: number
  reversed: boolean
}

function isGap(code: number) {
  return code === DASH || code === SPACE
}

class CigarRuns {
  private ops: string[] = []
  private lens: number[] = []

  push(op: string) {
    const last = this.ops.length - 1
    if (last >= 0 && this.ops[last] === op) {
      this.lens[last]!++
    } else {
      this.ops.push(op)
      this.lens.push(1)
    }
  }

  toString() {
    return this.ops.map((op, i) => `${this.lens[i]}${op}`).join('')
  }
}

/**
 * A MAF row over a reference range, as synteny features — one per block the
 * row aligns in — with no adapter and no preprocessing: the gapped columns
 * already state the per-base correspondence a PAF states as a CIGAR.
 *
 * Column by column: both bases is `M`, a reference gap is `I` (the row has a
 * base the reference lacks), a row gap is `D`. Only columns whose reference
 * base lies inside `[startBp, endBp)` count, plus the insertions between two
 * such bases — an insertion after the last included base falls outside, the
 * half-open way. The row's own coordinates come through `forwardPos`, the same
 * mirror through `srcSize` the hover and the navigation target use, so a
 * `-`-strand row's mate span cannot disagree with either.
 *
 * A `-` row is emitted on the minus strand with the mate in forward
 * coordinates: walking the columns forward walks the row from its mate END
 * backwards, which is exactly the orientation a synteny CIGAR is read in.
 *
 * A block in which the row has no base inside the range yields no feature — a
 * deletion-only block is not an alignment of anything. A row that changes
 * chromosome between blocks keeps the first chromosome, as `findRowSpan` does,
 * so the result is one navigable locus. `undefined` when nothing aligns.
 */
export function buildMafRowSynteny({
  region,
  startBp,
  endBp,
  rowIndex,
  refName,
  mateAssembly,
  idPrefix,
}: {
  region: MafRegionData
  startBp: number
  endBp: number
  rowIndex: number
  refName: string
  mateAssembly: string
  idPrefix: string
}): MafRowSynteny | undefined {
  const features: MafRowSyntenyFeature[] = []
  let chr: string | undefined
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  let minusBlocks = 0
  for (const block of region.blocks) {
    if (block.startBp >= endBp) {
      break
    }
    if (block.endBp <= startBp) {
      continue
    }
    const row = block.rows.find(r => r.rowIndex === rowIndex)
    if (
      !row ||
      row.chr === undefined ||
      row.start === undefined ||
      (chr !== undefined && row.chr !== chr)
    ) {
      continue
    }
    const ref = block.refSeqBytes
    const aln = row.alignmentBytes
    const len = Math.min(ref.length, aln.length)
    const runs = new CigarRuns()
    let refBp = block.startBp
    let baseOffset = 0
    let refStart: number | undefined
    let refEnd = 0
    let firstBase: number | undefined
    let lastBase: number | undefined
    for (let i = 0; i < len; i++) {
      const refBase = !isGap(ref[i]!)
      const rowBase = !isGap(aln[i]!)
      let included = false
      if (refBase) {
        included = refBp >= startBp && refBp < endBp
        if (included) {
          refStart ??= refBp
          refEnd = refBp + 1
          runs.push(rowBase ? 'M' : 'D')
        }
        refBp++
      } else if (rowBase) {
        included = refStart !== undefined && refBp < endBp
        if (included) {
          runs.push('I')
        }
      }
      if (rowBase) {
        if (included) {
          firstBase ??= baseOffset
          lastBase = baseOffset
        }
        baseOffset++
      }
    }
    if (
      refStart === undefined ||
      firstBase === undefined ||
      lastBase === undefined
    ) {
      continue
    }
    const a = forwardPos(row, firstBase)
    const b = forwardPos(row, lastBase)
    if (a === undefined || b === undefined) {
      continue
    }
    chr ??= row.chr
    const mateStart = Math.min(a, b)
    const mateEnd = Math.max(a, b) + 1
    lo = Math.min(lo, mateStart)
    hi = Math.max(hi, mateEnd)
    const strand = row.strand === -1 ? -1 : 1
    if (strand === -1) {
      minusBlocks++
    }
    const syntenyId = features.length
    const uniqueId = `${idPrefix}-${syntenyId}`
    features.push({
      uniqueId,
      refName,
      start: refStart,
      end: refEnd,
      strand,
      CIGAR: runs.toString(),
      syntenyId,
      mate: {
        uniqueId: `${uniqueId}_mate`,
        refName: row.chr,
        start: mateStart,
        end: mateEnd,
        assemblyName: mateAssembly,
        syntenyId,
      },
    })
  }
  return chr === undefined
    ? undefined
    : {
        features,
        refName: chr,
        start: lo,
        end: hi,
        reversed: minusBlocks * 2 > features.length,
      }
}
