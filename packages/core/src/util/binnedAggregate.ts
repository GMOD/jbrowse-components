// The interval `bin` and the `aggregate` behind it as one kernel, which
// `runSteps` in featureTransforms.ts reaches by relative path only.
import { readerOf } from './featureTable.ts'
import { isPlainFieldRef } from './fieldReader.ts'
import { isJexl } from './jexlStrings.ts'
import {
  BIN_OVERLAP_FIELD,
  DEFAULT_BIN_AS,
  OpSums,
  binSize,
  groupKey,
  intervalsOf,
  isWeighted,
  madeGroups,
  stepNumberReader,
} from './stepTables.ts'

import type { AggregateStep, BinStep } from './markEncodingTypes.ts'
import type { Bounds, Staged } from './stepTables.ts'

/**
 * The bin's edges and `overlap` a piece carries, where an `aggregate` reads a
 * field off a piece: the row's own field where the bin wrote none. A later
 * entry of the bin's written fields shadows an earlier one of the same name,
 * as the piece table's columns do.
 */
const FROM_ROW = 0
const FROM_BIN_START = 1
const FROM_BIN_END = 2
const FROM_OVERLAP = 3

function pieceSource(field: string, [asStart, asEnd]: readonly string[]) {
  return field === BIN_OVERLAP_FIELD
    ? FROM_OVERLAP
    : field === asEnd
      ? FROM_BIN_END
      : field === asStart
        ? FROM_BIN_START
        : FROM_ROW
}

function pick(
  source: number,
  row: number,
  lo: number,
  hi: number,
  overlap: number,
) {
  return source === FROM_ROW
    ? row
    : source === FROM_BIN_START
      ? lo
      : source === FROM_BIN_END
        ? hi
        : overlap
}

/**
 * Whether an interval `bin` and the `aggregate` behind it run as one kernel:
 * the aggregate groups by the bin's two edges, and every field it reads is a
 * plain name, so a piece's value is its row's or one the bin wrote.
 */
export function fusesBinAggregate(bin: BinStep, agg: AggregateStep) {
  const as = bin.as ?? DEFAULT_BIN_AS
  const groupby = agg.groupby ?? []
  const plain = (field: string | undefined) =>
    field === undefined || (isPlainFieldRef(field) && !isJexl(field))
  return (
    bin.fields !== undefined &&
    as[0] !== as[1] &&
    groupby.length === 2 &&
    as.every(edge => groupby.includes(edge)) &&
    as.every(plain) &&
    agg.ops.every(op => plain(op.field) && plain(op.weight))
  )
}

// Beyond this many bins over the pieces a dense bin index costs more than the
// pieces would, and the two steps run as written.
const SPARSE_BINS_PER_PIECE = 2
const SPARSE_BINS_SLACK = 65536

/**
 * An interval `bin` and the `aggregate` grouped by its edges as one walk: each
 * row's bins accumulate straight into their group's sums, with no piece table,
 * the way `binRawRegion` bins a BigWig's raw section. The groups come out in
 * the order the pieces would have met them and each sum adds its pieces in
 * the pieces' order, so the answer is the two steps' to the bit. Undefined
 * where the bins spread too thinly over the region for a dense index.
 */
export function binnedAggregate(
  { table, bounds }: Staged,
  bin: BinStep,
  agg: AggregateStep,
): Staged | undefined {
  const size = binSize(bin)
  const as = bin.as ?? DEFAULT_BIN_AS
  const iv = intervalsOf(table, bin.fields!, size, bounds)
  const { lowBin, highBin } = iv
  const sections = bounds.length - 1
  // Each section's bins from its lowest, at `offset[s]` in one index.
  const offset = new Float64Array(sections + 1)
  for (let s = 0; s < sections; s++) {
    const span = highBin[s]! - lowBin[s]! + 1
    offset[s + 1] = offset[s]! + (span > 0 ? span : 0)
  }
  const spans = offset[sections]!
  if (spans > SPARSE_BINS_PER_PIECE * iv.pieces + SPARSE_BINS_SLACK) {
    return undefined
  }
  const capacity = Math.min(spans, iv.pieces)
  const groupOfBin = new Int32Array(spans).fill(-1)
  const groupRow = new Uint32Array(capacity)
  const groupBin = new Float64Array(capacity)
  const groupSection = new Uint32Array(capacity)
  const start = new Float64Array(capacity)
  const end = new Float64Array(capacity)
  const startSource = pieceSource('start', as)
  const endSource = pieceSource('end', as)
  // A group's extent is its bin's where the pieces' start and end are the
  // bin's edges, the least and greatest of its pieces' otherwise.
  const binExtent = startSource === FROM_BIN_START && endSource === FROM_BIN_END
  const readRowStart = readerOf(table.column('start'))
  const readRowEnd = readerOf(table.column('end'))

  const groups = numberGroups(
    { iv, bounds, size, lowBin, offset, groupOfBin },
    { groupRow, groupBin, groupSection, start, end },
    binExtent
      ? undefined
      : { startSource, endSource, readRowStart, readRowEnd },
  )

  const walk = { iv, bounds, size, lowBin, offset, groupOfBin }
  const ops = agg.ops.map(op => {
    const sums = new OpSums(op, groups)
    const valueSource =
      op.op === 'count' || op.field === undefined
        ? undefined
        : pieceSource(op.field, as)
    const weightSource =
      op.weight !== undefined && isWeighted(op)
        ? pieceSource(op.weight, as)
        : undefined
    const rowNumbers = (
      field: string | undefined,
      source: number | undefined,
    ) =>
      field !== undefined && source === FROM_ROW
        ? stepNumberReader(table, field, 'an aggregate')
        : undefined
    const readValue = rowNumbers(op.field, valueSource)
    const readWeight = rowNumbers(op.weight, weightSource)
    if (
      (valueSource === undefined || readValue) &&
      (weightSource === undefined ||
        readWeight ||
        weightSource === FROM_OVERLAP)
    ) {
      addByRow(walk, sums, readValue, readWeight, weightSource === FROM_OVERLAP)
    } else {
      addByPiece(walk, sums, valueSource, weightSource, readValue, readWeight)
    }
    return sums.column(groups)
  })

  // A field's value on each group's first piece.
  const each = (field: string) => {
    const source = pieceSource(field, as)
    const read = readerOf(table.column(field))
    const out = new Array<unknown>(groups)
    for (let g = 0; g < groups; g++) {
      const i = groupRow[g]!
      const lo = groupBin[g]! * size
      const hi = lo + size
      out[g] =
        source === FROM_ROW
          ? read(i)
          : pick(
              source,
              0,
              lo,
              hi,
              Math.min(iv.end[i]!, hi) - Math.max(iv.start[i]!, lo),
            )
    }
    return out
  }
  return madeGroups({
    groups,
    keys: (agg.groupby ?? []).map((field): [string, unknown[]] => [
      field,
      each(field).map(groupKey),
    ]),
    ops,
    step: agg,
    refNames: each('refName'),
    start: start.slice(0, groups),
    end: end.slice(0, groups),
    sectionOf: groupSection,
    sections: bounds.length,
  })
}

interface BinWalk {
  iv: ReturnType<typeof intervalsOf>
  bounds: Bounds
  size: number
  lowBin: Float64Array
  offset: Float64Array
  groupOfBin: Int32Array
}

/**
 * Each bin's group, numbered in the order the pieces meet them, with the
 * first piece's row, the bin and the section, and each group's extent: its
 * bin's, or the least start and greatest end its pieces read where `extent`
 * says where they read them. Answers how many groups there are.
 */
function numberGroups(
  { iv, bounds, size, lowBin, offset, groupOfBin }: BinWalk,
  out: {
    groupRow: Uint32Array
    groupBin: Float64Array
    groupSection: Uint32Array
    start: Float64Array
    end: Float64Array
  },
  extent:
    | {
        startSource: number
        endSource: number
        readRowStart: (i: number) => unknown
        readRowEnd: (i: number) => unknown
      }
    | undefined,
) {
  const { groupRow, groupBin, groupSection, start, end } = out
  let groups = 0
  for (let s = 0; s + 1 < bounds.length; s++) {
    const base = offset[s]! - lowBin[s]!
    for (let i = bounds[s]!; i < bounds[s + 1]!; i++) {
      const first = iv.first[i]!
      if (Number.isNaN(first)) {
        continue
      }
      const last = iv.last[i]!
      for (let b = first; b <= last; b++) {
        let g = groupOfBin[base + b]!
        if (g < 0) {
          g = groups++
          groupOfBin[base + b] = g
          groupRow[g] = i
          groupBin[g] = b
          groupSection[g] = s
          start[g] = b * size
          end[g] = b * size + size
        }
      }
    }
  }
  if (extent) {
    start.fill(Infinity)
    end.fill(-Infinity)
    const { startSource, endSource, readRowStart, readRowEnd } = extent
    for (let s = 0; s + 1 < bounds.length; s++) {
      const base = offset[s]! - lowBin[s]!
      for (let i = bounds[s]!; i < bounds[s + 1]!; i++) {
        const first = iv.first[i]!
        if (Number.isNaN(first)) {
          continue
        }
        const ownStart = readRowStart(i) as number
        const ownEnd = readRowEnd(i) as number
        for (let b = first; b <= iv.last[i]!; b++) {
          const g = groupOfBin[base + b]!
          const lo = b * size
          const hi = lo + size
          const overlap = Math.min(iv.end[i]!, hi) - Math.max(iv.start[i]!, lo)
          start[g] = Math.min(
            start[g]!,
            pick(startSource, ownStart, lo, hi, overlap),
          )
          end[g] = Math.max(end[g]!, pick(endSource, ownEnd, lo, hi, overlap))
        }
      }
    }
  }
  return groups
}

/**
 * One op's sums where its value is its row's and its weight its row's, its
 * piece's overlap or none: a row whose value or weight is not a number adds
 * nothing to any bin, so it is skipped whole. A piece's overlap is always a
 * number, since the row's ends are.
 */
function addByRow(
  { iv, bounds, size, lowBin, offset, groupOfBin }: BinWalk,
  { sum, weight, min, max, op }: OpSums,
  readValue: ((i: number) => number) | undefined,
  readWeight: ((i: number) => number) | undefined,
  byOverlap: boolean,
) {
  const readsValue = op !== 'count'
  for (let s = 0; s + 1 < bounds.length; s++) {
    const base = offset[s]! - lowBin[s]!
    for (let i = bounds[s]!; i < bounds[s + 1]!; i++) {
      const first = iv.first[i]!
      const v = readValue ? readValue(i) : Number.NaN
      const rowWeight = readWeight ? readWeight(i) : 1
      if (
        Number.isNaN(first) ||
        (readsValue && !Number.isFinite(v)) ||
        !Number.isFinite(rowWeight)
      ) {
        continue
      }
      const rowS = iv.start[i]!
      const rowE = iv.end[i]!
      const last = iv.last[i]!
      for (let b = first; b <= last; b++) {
        const g = groupOfBin[base + b]!
        const lo = b * size
        const w = byOverlap
          ? Math.min(rowE, lo + size) - Math.max(rowS, lo)
          : rowWeight
        weight[g]! += w
        if (readsValue) {
          sum[g]! += v * w
          if (v < min[g]!) {
            min[g] = v
          }
          if (v > max[g]!) {
            max[g] = v
          }
        }
      }
    }
  }
}

/** One op's sums where its value or weight is a field the bin wrote. */
function addByPiece(
  { iv, bounds, size, lowBin, offset, groupOfBin }: BinWalk,
  sums: OpSums,
  valueSource: number | undefined,
  weightSource: number | undefined,
  readValue: ((i: number) => number) | undefined,
  readWeight: ((i: number) => number) | undefined,
) {
  for (let s = 0; s + 1 < bounds.length; s++) {
    const base = offset[s]! - lowBin[s]!
    for (let i = bounds[s]!; i < bounds[s + 1]!; i++) {
      const first = iv.first[i]!
      if (Number.isNaN(first)) {
        continue
      }
      const rowV = readValue ? readValue(i) : Number.NaN
      const rowW = readWeight ? readWeight(i) : 1
      const last = iv.last[i]!
      for (let b = first; b <= last; b++) {
        const lo = b * size
        const hi = lo + size
        const overlap = Math.min(iv.end[i]!, hi) - Math.max(iv.start[i]!, lo)
        sums.add(
          groupOfBin[base + b]!,
          valueSource === undefined
            ? Number.NaN
            : pick(valueSource, rowV, lo, hi, overlap),
          weightSource === undefined
            ? 1
            : pick(weightSource, rowW, lo, hi, overlap),
        )
      }
    }
  }
}
