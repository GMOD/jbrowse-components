import { EMPTY_INSERTIONS } from '@jbrowse/alignments-core'
import { isGapByte } from '@jbrowse/core/util/alignedBytes'

import { blockHasRefGap, forEachInsertion } from './forEachInsertion.ts'

import type {
  MafAlignedRow,
  MafRegionData,
} from '../mafRenderingBackendTypes.ts'
import type { InsertionChannels } from '@jbrowse/alignments-core'

type Placed = Omit<InsertionChannels, 'color'>

/** One block's share of an insertion: a run of its reference-gap columns. */
export interface InsertionPart {
  row: MafAlignedRow
  /** this row's own bases before the run */
  baseOffset: number
  byteStart: number
  byteEnd: number
}

export interface RegionInsertion {
  rowIndex: number
  anchorBp: number
  length: number
  parts: InsertionPart[]
}

const recordsCache = new WeakMap<MafRegionData, RegionInsertion[]>()
const placedCache = new WeakMap<MafRegionData, Placed>()
const mergedCache = new WeakMap<Placed, { binBp: number; merged: Placed }>()

function alignedBases(bytes: Uint8Array) {
  let n = 0
  for (const byte of bytes) {
    if (!isGapByte(byte)) {
      n++
    }
  }
  return n
}

// Multiz splits a block where a species changes contig or strand, so two runs
// at one anchor are one insertion only where the row's sequence carries on.
function continues(prev: MafAlignedRow, next: MafAlignedRow) {
  return (
    prev.srcStart === undefined ||
    next.srcStart === undefined ||
    (prev.chr === next.chr &&
      prev.strand === next.strand &&
      next.srcStart === prev.srcStart + alignedBases(prev.alignmentBytes))
  )
}

/**
 * Every insertion in a region, in ascending bp per row: a run of
 * reference-gap columns where a sample carries bases, anchored at the
 * reference base after the run. A run that a block boundary splits, the row
 * carrying on into the abutting block, is one insertion of two parts.
 * `blockHasRefGap` answers for every row of a block at once, and most real
 * MAF blocks have no gap. Keyed on the region object, which
 * `placeMafRegionData` replaces per fetch and per row reorder.
 */
export function regionInsertions(region: MafRegionData): RegionInsertion[] {
  let records = recordsCache.get(region)
  if (records === undefined) {
    const found: RegionInsertion[] = []
    const lastOfRow = new Map<number, RegionInsertion>()
    for (const block of region.blocks) {
      if (blockHasRefGap(block)) {
        for (const r of block.rows) {
          forEachInsertion(
            block.refSeqBytes,
            r.alignmentBytes,
            block.startBp,
            (anchorBp, length, baseOffset, byteStart, byteEnd) => {
              const part = { row: r, baseOffset, byteStart, byteEnd }
              const last = lastOfRow.get(r.rowIndex)
              if (
                last?.anchorBp === anchorBp &&
                continues(last.parts.at(-1)!.row, r)
              ) {
                last.length += length
                last.parts.push(part)
              } else {
                const record = {
                  rowIndex: r.rowIndex,
                  anchorBp,
                  length,
                  parts: [part],
                }
                lastOfRow.set(r.rowIndex, record)
                found.push(record)
              }
            },
          )
        }
      }
    }
    records = found
    recordsCache.set(region, records)
  }
  return records
}

function placedInsertions(region: MafRegionData): Placed {
  let placed = placedCache.get(region)
  if (placed === undefined) {
    const records = regionInsertions(region)
    const xs = Uint32Array.from(records, r => r.anchorBp)
    placed = {
      x: xs,
      x2: xs,
      row: Uint32Array.from(records, r => r.rowIndex),
      length: Uint32Array.from(records, r => r.length),
      count: xs.length,
    }
    placedCache.set(region, placed)
  }
  return placed
}

/**
 * `placed` with each row's insertions in one `binBp` bin collapsed to the
 * longest, as the cells collapse to one sample per bin. A bin is under a CSS
 * pixel, and a longer insertion's marker is at least as wide, so the picture
 * barely moves while a zoomed-out region's hundreds of thousands of markers
 * drop to a few per pixel column: the Canvas2D painter and the SVG export pay
 * per marker. A row's insertions arrive in ascending bp, so a bin's are
 * adjacent and the merge needs only each row's last bin.
 */
export function mergeInsertionsPerBin(placed: Placed, binBp: number): Placed {
  const { x, row, length, count } = placed
  if (binBp <= 1 || count === 0) {
    return placed
  }
  let rows = 0
  for (let i = 0; i < count; i++) {
    rows = Math.max(rows, row[i]! + 1)
  }
  const lastBin = new Float64Array(rows).fill(-1)
  const lastOut = new Int32Array(rows)
  const outX = new Uint32Array(count)
  const outRow = new Uint32Array(count)
  const outLength = new Uint32Array(count)
  let n = 0
  for (let i = 0; i < count; i++) {
    const r = row[i]!
    const bin = Math.floor(x[i]! / binBp)
    if (lastBin[r] === bin) {
      const o = lastOut[r]!
      if (length[i]! > outLength[o]!) {
        outX[o] = x[i]!
        outLength[o] = length[i]!
      }
    } else {
      lastBin[r] = bin
      lastOut[r] = n
      outX[n] = x[i]!
      outRow[n] = r
      outLength[n] = length[i]!
      n++
    }
  }
  const xs = outX.slice(0, n)
  return {
    x: xs,
    x2: xs,
    row: outRow.slice(0, n),
    length: outLength.slice(0, n),
    count: n,
  }
}

export function mergedInsertions(region: MafRegionData, binBp: number) {
  const placed = placedInsertions(region)
  const hit = mergedCache.get(placed)
  if (hit?.binBp === binBp) {
    return hit.merged
  }
  const merged = mergeInsertionsPerBin(placed, binBp)
  mergedCache.set(placed, { binBp, merged })
  return merged
}

/**
 * The insertion mark's channels for one region: each insertion interbase at
 * its anchor, on its species row, in `insertionAbgr`, the longest per row in
 * each `binBp` bin.
 */
export function mafInsertionChannels(
  region: MafRegionData,
  insertionAbgr: number,
  binBp: number,
): InsertionChannels {
  const placed = mergedInsertions(region, binBp)
  return placed.count === 0
    ? EMPTY_INSERTIONS
    : { ...placed, color: new Uint32Array(placed.count).fill(insertionAbgr) }
}
