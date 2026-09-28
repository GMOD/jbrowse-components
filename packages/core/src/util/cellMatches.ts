// A `cells` step, the interval `bin` behind it and the `aggregate` of its
// matches as one walk over the rows' bytes, which `runSteps` in
// featureTransforms.ts reaches by relative path only.
import { fusesBinAggregate } from './binnedAggregate.ts'
import {
  DASH,
  DEFAULT_CELLS_FIELD,
  MATCH,
  MISMATCH,
  NO_STATE,
  SPACE,
  cellState,
  firstDrawn,
  isGapByte,
  lastDrawn,
  walkedTexts,
} from './cellsStep.ts'
import { numberReaderOf, readerOf } from './featureTable.ts'
import {
  BIN_OVERLAP_FIELD,
  DEFAULT_BIN_AS,
  OpSums,
  groupKey,
  madeGroups,
} from './stepTables.ts'

import type {
  AggregateStep,
  BinStep,
  CellsStep,
  TransformStep,
} from './markEncodingTypes.ts'
import type { Staged } from './stepTables.ts'

const isEdges = (pair: readonly string[] | undefined) =>
  pair?.length === 2 && pair[0] === 'start' && pair[1] === 'end'

/**
 * Whether a `cells` step, an interval `bin` and an `aggregate` run as one
 * walk: the bin cuts the runs' own extents at whole-base edges it writes as
 * `start` and `end`, the aggregate groups by those, and every op is the sum or
 * mean of `match` weighted by `overlap`, so a bin's answer is its bases
 * matched and compared.
 */
export function fusesCellMatches(
  _cells: CellsStep,
  bin: BinStep,
  agg: AggregateStep,
) {
  return (
    fusesBinAggregate(bin, agg) &&
    isEdges(bin.fields) &&
    isEdges(bin.as ?? DEFAULT_BIN_AS) &&
    Number.isInteger(bin.step) &&
    bin.step > 0 &&
    agg.ops.length > 0 &&
    agg.ops.every(
      op =>
        (op.op === 'mean' || op.op === 'sum') &&
        op.field === 'match' &&
        op.weight === BIN_OVERLAP_FIELD,
    )
  )
}

/** Whether a step list starts with the bin and aggregate a `cells` fuses with. */
export function fusesAfterCells(
  cells: CellsStep,
  steps: readonly TransformStep[] | undefined,
) {
  const [bin, agg] = steps ?? []
  return (
    bin?.type === 'bin' &&
    agg?.type === 'aggregate' &&
    fusesCellMatches(cells, bin, agg)
  )
}

// Where the widest section spans more bins than this over the bins all the
// rows could reach, its dense index costs more than the runs would, and the
// steps run as written.
const SPARSE_BINS_SLACK = 65536
// A run's start is a Uint32 lane in the unfused `cells`.
const MAX_POSITION = 2 ** 32

/**
 * The groups the pieces of a section's runs meet, numbered in the order they
 * meet them, over one dense index of the section's bins that each section
 * reuses; with each bin's bases matched and compared.
 */
class SectionBins {
  readonly groupOfBin: Int32Array
  readonly matched: Float64Array
  readonly compared: Float64Array
  readonly groupRow: Uint32Array
  readonly groupBin: Float64Array
  readonly groupSection: Uint32Array
  readonly groupMatched: Float64Array
  readonly groupCompared: Float64Array
  groups = 0
  low = 0
  section = 0
  private sectionStart = 0

  constructor(span: number, capacity: number) {
    this.groupOfBin = new Int32Array(span).fill(-1)
    this.matched = new Float64Array(span)
    this.compared = new Float64Array(span)
    this.groupRow = new Uint32Array(capacity)
    this.groupBin = new Float64Array(capacity)
    this.groupSection = new Uint32Array(capacity)
    this.groupMatched = new Float64Array(capacity)
    this.groupCompared = new Float64Array(capacity)
  }

  open(section: number, low: number) {
    this.section = section
    this.low = low
    this.sectionStart = this.groups
  }

  // A piece's bin from `from` to `to`, a new group where no piece met it.
  touch(from: number, to: number, r: number) {
    const { groupOfBin, low } = this
    for (let b = from; b <= to; b++) {
      if (groupOfBin[b - low]! < 0) {
        const g = this.groups++
        groupOfBin[b - low] = g
        this.groupRow[g] = r
        this.groupBin[g] = b
        this.groupSection[g] = this.section
      }
    }
  }

  // The section's counts onto its groups, and its bins cleared for the next.
  close() {
    const { groupOfBin, matched, compared, low } = this
    for (let g = this.sectionStart; g < this.groups; g++) {
      const k = this.groupBin[g]! - low
      this.groupMatched[g] = matched[k]!
      this.groupCompared[g] = compared[k]!
      matched[k] = 0
      compared[k] = 0
      groupOfBin[k] = -1
    }
  }

  /**
   * One row's runs as `cells` writes them, each met by its bins as the bin
   * step cuts it and in the order the lanes hold them: a run when the next
   * column's state differs, an insertion at the reference base after it,
   * ahead of the run still open. The bases a run of matches or mismatches
   * holds are counted in their bins as the walk passes them.
   */
  walk(
    r: number,
    startPos: number,
    size: number,
    rowBytes: Uint8Array,
    rowAt: number,
    rowLen: number,
    refBytes: Uint8Array,
    refAt: number,
    refLen: number,
  ) {
    const { matched, compared, low } = this
    const first = firstDrawn(rowBytes, rowAt, rowLen)
    const last = lastDrawn(rowBytes, rowAt, rowLen, first)
    let pos = startPos
    let bin = Math.floor(pos / size)
    let edge = bin * size + size
    let m = 0
    let c = 0
    let runOpen = false
    let runBin = 0
    let runState = NO_STATE
    let runBase = -1
    let inserting = false
    for (let col = 0; col < refLen; col++) {
      const refByte = refBytes[refAt + col]!
      const rowByte = col < rowLen ? rowBytes[rowAt + col]! : SPACE
      if (refByte === DASH) {
        if (!inserting && col < rowLen && !isGapByte(rowByte)) {
          inserting = true
        }
        continue
      }
      if (inserting) {
        this.touch(bin, bin, r)
        inserting = false
      }
      const st = cellState(
        refByte,
        rowByte,
        col >= first && col <= last && col < rowLen,
      )
      const base = st === MISMATCH ? rowByte : -1
      if (st !== runState || base !== runBase) {
        if (runOpen) {
          this.touch(runBin, pos > edge - size ? bin : bin - 1, r)
        }
        runOpen = st !== NO_STATE
        runBin = bin
        runState = st
        runBase = base
      }
      if (st === MATCH) {
        m++
        c++
      } else if (st === MISMATCH) {
        c++
      }
      pos++
      if (pos === edge) {
        if (c > 0) {
          matched[bin - low]! += m
          compared[bin - low]! += c
          m = 0
          c = 0
        }
        bin++
        edge += size
      }
    }
    if (runOpen) {
      this.touch(runBin, pos > edge - size ? bin : bin - 1, r)
    }
    if (c > 0) {
      matched[bin - low]! += m
      compared[bin - low]! += c
    }
  }
}

/**
 * `cells`, then a `bin` over the runs' extents and the `aggregate` of their
 * `match` weighted by `overlap`, in one walk with no run table: each bin's
 * bases matched and compared, counted straight off the texts. Every run
 * meets its bins in the order its lanes would hold it, so the groups come out
 * where the three steps put them, and a weighted sum of 0s and 1s is an
 * integer, so each sum is theirs to the bit. Undefined where a row's start is
 * not a whole base inside a Uint32 or the bins spread too thinly for a dense
 * index, and the steps run as written.
 */
export function binnedCellMatches(
  { table, bounds }: Staged,
  cells: CellsStep,
  bin: BinStep,
  agg: AggregateStep,
): Staged | undefined {
  const { field = DEFAULT_CELLS_FIELD } = cells
  const texts = walkedTexts(table, field)
  const readStart = numberReaderOf(table.column('start'))
  const size = bin.step
  const sections = bounds.length - 1
  const lowBin = new Float64Array(sections)
  let widest = 0
  let reach = 0
  let spans = 0
  for (let s = 0; s < sections; s++) {
    let low = Infinity
    let high = -Infinity
    for (let r = bounds[s]!; r < bounds[s + 1]!; r++) {
      const refLen = texts.reference.length[texts.refOf(r)]!
      const pos = readStart(r)
      if (refLen > 0 && pos >= 0) {
        if (!Number.isInteger(pos) || pos + refLen >= MAX_POSITION) {
          return undefined
        }
        const lo = Math.floor(pos / size)
        const hi = Math.floor((pos + refLen) / size)
        low = Math.min(low, lo)
        high = Math.max(high, hi)
        reach += hi - lo + 1
      }
    }
    lowBin[s] = low
    const span = high >= low ? high - low + 1 : 0
    widest = Math.max(widest, span)
    spans += span
  }
  if (widest > 2 * reach + SPARSE_BINS_SLACK) {
    return undefined
  }
  const { bytes: rowBytes, offset: rowOffset, length: rowLength } = texts.row
  const {
    bytes: refBytes,
    offset: refOffset,
    length: refLength,
  } = texts.reference
  const walk = new SectionBins(widest, Math.min(spans, reach))
  for (let s = 0; s < sections; s++) {
    walk.open(s, lowBin[s]!)
    for (let r = bounds[s]!; r < bounds[s + 1]!; r++) {
      const f = texts.refOf(r)
      const refLen = refLength[f]!
      const pos = readStart(r)
      if (refLen > 0 && pos >= 0) {
        const k = texts.rowOf(r)
        walk.walk(
          r,
          pos,
          size,
          rowBytes,
          rowOffset[k]!,
          rowLength[k]!,
          refBytes,
          refOffset[f]!,
          refLen,
        )
      }
    }
    walk.close()
  }

  const { groups, groupRow, groupBin, groupSection } = walk
  const ops = agg.ops.map(op => {
    const sums = new OpSums(op, groups)
    sums.sum.set(walk.groupMatched.subarray(0, groups))
    sums.weight.set(walk.groupCompared.subarray(0, groups))
    return sums.column(groups)
  })
  const start = new Float64Array(groups)
  const end = new Float64Array(groups)
  for (let g = 0; g < groups; g++) {
    start[g] = groupBin[g]! * size
    end[g] = start[g]! + size
  }
  const readRef = readerOf(table.column('refName'))
  const refNames = new Array<unknown>(groups)
  for (let g = 0; g < groups; g++) {
    refNames[g] = readRef(groupRow[g]!)
  }
  return madeGroups({
    groups,
    keys: (agg.groupby ?? []).map((field): [string, unknown[]] => [
      field,
      Array.from(field === 'start' ? start : end, groupKey),
    ]),
    ops,
    step: agg,
    refNames,
    start,
    end,
    sectionOf: groupSection,
    sections: bounds.length,
  })
}
