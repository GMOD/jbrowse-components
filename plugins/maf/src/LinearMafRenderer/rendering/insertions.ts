import { EMPTY_INSERTIONS } from '@jbrowse/alignments-core'

import { blockHasRefGap, forEachInsertion } from './forEachInsertion.ts'

import type { MafRegionData } from '../mafRenderingBackendTypes.ts'
import type { InsertionChannels } from '@jbrowse/alignments-core'

type Placed = Omit<InsertionChannels, 'color'>

const placedCache = new WeakMap<MafRegionData, Placed>()
const mergedCache = new WeakMap<Placed, { binBp: number; merged: Placed }>()

/**
 * Every insertion in a region, as `(anchorBp, rowIndex, length)`: a run of
 * reference-gap columns where a sample carries bases, anchored at the
 * reference base after the run. `blockHasRefGap` answers for every row of a
 * block at once, and most real MAF blocks have no gap. Keyed on the region
 * object, which `placeMafRegionData` replaces per fetch and per row reorder,
 * so a re-encode for a theme or zoom change walks nothing.
 */
function placedInsertions(region: MafRegionData): Placed {
  let placed = placedCache.get(region)
  if (placed === undefined) {
    const x: number[] = []
    const row: number[] = []
    const length: number[] = []
    for (const block of region.blocks) {
      if (blockHasRefGap(block)) {
        for (const r of block.rows) {
          forEachInsertion(
            block.refSeqBytes,
            r.alignmentBytes,
            block.startBp,
            (anchorBp, len) => {
              x.push(anchorBp)
              row.push(r.rowIndex)
              length.push(len)
            },
          )
        }
      }
    }
    const xs = Uint32Array.from(x)
    placed = {
      x: xs,
      x2: xs,
      row: Uint32Array.from(row),
      length: Uint32Array.from(length),
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
