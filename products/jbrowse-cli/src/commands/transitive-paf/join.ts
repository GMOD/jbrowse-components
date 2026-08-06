import { composeCoarse, composeThroughPivot, orientToPivot } from './compose.ts'
import { panSNSample } from './paf.ts'
import { dropRedundant } from './redundancy.ts'

import type { PafRow } from './paf.ts'
import type { Task } from './plan.ts'

/**
 * Re-state a row so the `via` SAMPLE's side is the target, whichever side of the
 * row it landed on. Composition works on a shared sequence, so what actually
 * matters downstream is that both legs present the same pivot contig as their
 * target axis.
 */
function orientToPivotSample(row: PafRow, via: string) {
  return panSNSample(row.tname) === via
    ? row
    : panSNSample(row.qname) === via
      ? orientToPivot(row, row.qname)
      : undefined
}

/** Group a leg's rows by the pivot contig they are anchored on. */
function byPivotContig(rows: PafRow[], via: string) {
  const out = new Map<string, PafRow[]>()
  for (const row of rows) {
    const oriented = orientToPivotSample(row, via)
    if (oriented) {
      const bucket = out.get(oriented.tname)
      if (bucket) {
        bucket.push(oriented)
      } else {
        out.set(oriented.tname, [oriented])
      }
    }
  }
  for (const bucket of out.values()) {
    bucket.sort((x, y) => x.tstart - y.tstart || x.tend - y.tend)
  }
  return out
}

/**
 * Every pair of alignments from the two legs that overlap on the pivot, composed.
 *
 * A sweep rather than a nested loop: both legs are sorted by pivot start, so an
 * alignment whose pivot end has been passed can never overlap again. The naive
 * form is the product of the two legs' sizes, and a leg on one chromosome of a
 * real pangenome is tens of thousands of rows.
 */
export async function composeLegs({
  task,
  legA,
  legB,
  minAligned,
  maxCovered,
  emit,
}: {
  task: Task
  legA: PafRow[]
  legB: PafRow[]
  minAligned: number
  maxCovered: number
  // awaited, so a caller writing to a stream can apply backpressure — one pair
  // of legs on one chromosome can compose to more rows than either leg holds
  emit: (row: PafRow) => Promise<void> | void
}) {
  const aByContig = byPivotContig(legA, task.via)
  const bByContig = byPivotContig(legB, task.via)
  let composed = 0
  // Counted, not silently swallowed: `--min-length` is the one knob between a
  // useful result and an empty one, and its default is wrong for any dataset
  // whose segments are shorter than it — odgi untangle's are ~4.7 kb against a
  // 5 kb default. A run that discarded most of what it built has to say so.
  let tooShort = 0
  let redundant = 0
  for (const [contig, aRows] of aByContig) {
    const bRows = bByContig.get(contig)
    if (!bRows) {
      continue
    }
    let j = 0
    // Held rather than emitted as they are built: the redundancy pass needs to
    // see a whole contig's compositions to know which ground is already held.
    // Bounded by one contig of one pair, which is where the pileup blowup lives.
    const built: PafRow[] = []
    const active: PafRow[] = []
    for (const a of aRows) {
      while (j < bRows.length && bRows[j]!.tstart < a.tend) {
        active.push(bRows[j]!)
        j++
      }
      let write = 0
      for (const b of active) {
        if (b.tend > a.tstart) {
          active[write++] = b
        }
      }
      active.length = write
      for (const b of active) {
        // A row that puts the SAME sequence on both ends is the pivot aligned to
        // itself through itself, which states nothing
        if (a.qname === b.qname) {
          continue
        }
        // Base-level composition needs base-level input. With a CIGAR missing
        // on either side the most that can be said is where the overlap starts
        // and ends on each, which is also all either input said.
        const coarse = a.cigar === undefined || b.cigar === undefined
        const row = coarse
          ? composeCoarse({ a, b, minAligned })
          : composeThroughPivot({ a, b, minAligned })
        if (row) {
          built.push(row)
        } else if (
          // it overlapped on the pivot, so `minAligned` is what rejected it
          Math.min(a.tend, b.tend) > Math.max(a.tstart, b.tstart) &&
          (coarse ? composeCoarse({ a, b }) : composeThroughPivot({ a, b })) !==
            undefined
        ) {
          tooShort++
        }
      }
    }
    const kept = dropRedundant(built, maxCovered)
    redundant += built.length - kept.length
    for (const row of kept) {
      await emit(row)
      composed++
    }
  }
  return { composed, tooShort, redundant }
}
