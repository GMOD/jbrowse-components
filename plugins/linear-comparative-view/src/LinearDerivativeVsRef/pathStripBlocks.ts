import { assembleLocString, getBpDisplayStr } from '@jbrowse/core/util'

import type { DerivativeSegment } from '@jbrowse/plugin-alignments'

// A candidate's shape at a glance: one block per segment, width proportional to
// how much reference the segment carries, in the order the reads cross them.
//
// This exists because the number the picker used to offer alongside each row —
// the path's TOTAL span — cannot answer the question the row is asked. The
// caveat above the list says a route whose segments are all about one read long
// is an aligner splitting a read rather than an allele; four 15kb segments and
// one 52kb arm carrying three sub-kilobase inserts both total ~60kb, so the sum
// is identical in the two cases it is supposed to separate. The DISTRIBUTION is
// what separates them, and a strip is how a distribution over four items is
// read.

export interface StripBlock {
  x: number
  width: number
  refName: string
  strand: number
  /** Palette slot, assigned per distinct refName in path order. */
  colorIndex: number
  /** Full description for the block's hover title. */
  title: string
}

export interface StripOpts {
  width: number
  gap?: number
  /**
   * Floor on a block's width. Strictly proportional, the 199bp hop of COLO829's
   * der(3) is a third of a pixel next to its 52kb arm and the strip claims the
   * path has one segment. A floored sliver is the honest drawing of "there is a
   * piece here and it is far too small to see", which is the reading the row
   * needs; the sizes beneath the strip carry the exact figures.
   */
  minBlockWidth?: number
}

const DEFAULTS = {
  gap: 2,
  minBlockWidth: 5,
}

function segmentLength(seg: DerivativeSegment) {
  return Math.max(1, seg.end - seg.start)
}

/**
 * Widths for a proportional strip in which no block disappears.
 *
 * Blocks whose proportional share falls under the floor are pinned to it and
 * taken out of the pool; the rest re-share what is left, which can push another
 * block under the floor, so it repeats until the pool is stable. One pass is not
 * enough — pinning three slivers of a four-segment path shrinks the fourth by
 * the same amount, and a path of forty hops is all floor.
 */
export function allocateWidths(
  lengths: number[],
  available: number,
  min: number,
) {
  const n = lengths.length
  if (available <= n * min) {
    // No proportional information survives at this size, so don't pretend to
    // any: equal blocks say "n segments" and nothing else, which is true.
    return lengths.map(() => available / n)
  }
  const widths = Array.from({ length: n }, () => 0)
  const pool = new Set(lengths.map((_, i) => i))
  let free = available
  for (;;) {
    let poolTotal = 0
    for (const i of pool) {
      poolTotal += lengths[i]!
    }
    const scale = free / poolTotal
    const pinned = [...pool].filter(i => lengths[i]! * scale < min)
    if (pinned.length === 0) {
      for (const i of pool) {
        widths[i] = lengths[i]! * scale
      }
      return widths
    }
    for (const i of pinned) {
      widths[i] = min
      pool.delete(i)
      free -= min
    }
  }
}

/**
 * Lay a candidate's segments out as a proportional strip `width` px wide.
 */
export function pathStripBlocks(
  segments: DerivativeSegment[],
  opts: StripOpts,
): StripBlock[] {
  const {
    width,
    gap: requestedGap = DEFAULTS.gap,
    minBlockWidth = DEFAULTS.minBlockWidth,
  } = opts
  const n = segments.length
  if (n === 0 || width <= 0) {
    return []
  }
  // The gaps come out of the same `width` the blocks do, so a path with more
  // hops than the strip has pixels for has to give them up. Nothing upstream
  // bounds the segment count — a real ngmlr-aligned ONT record in COLO829
  // carries 943 SA entries — and at 460px with a 2px gap the gaps alone exceed
  // the strip from 155 segments on, so the blocks were laid out past the
  // viewBox and the strip silently drew a prefix of the path as if it were the
  // whole of it. Squeezed to 0 the blocks abut, which is the honest drawing of
  // "too many pieces to separate".
  const gap =
    n > 1 ? Math.min(requestedGap, Math.max(0, (width - n) / (n - 1))) : 0
  const available = width - gap * (n - 1)
  const widths = allocateWidths(
    segments.map(segmentLength),
    available,
    minBlockWidth,
  )
  // One color per chromosome, not per block, so a path that leaves a chromosome
  // and comes back says so: the first and last blocks of COLO829's der(3) are
  // the same color, which is the whole reason that path is a cycle rather than a
  // translocation.
  const colorIndexes = new Map<string, number>()
  let x = 0
  return segments.map((seg, i) => {
    let colorIndex = colorIndexes.get(seg.refName)
    if (colorIndex === undefined) {
      colorIndex = colorIndexes.size
      colorIndexes.set(seg.refName, colorIndex)
    }
    const blockWidth = widths[i]!
    const block = {
      x,
      width: blockWidth,
      refName: seg.refName,
      strand: seg.strand,
      colorIndex,
      // `assembleLocString`, not the coordinates spelled out here. A segment is
      // half-open and 0-based in this file and every other one that computes on
      // it; the hand-rolled string printed that interior form, so the same
      // segment read one base lower in the tooltip than in the label the drawn
      // view puts under it (`buildDerivativeVsRefSpec`) and than in the
      // locstring the location box takes.
      title: `${assembleLocString({
        refName: seg.refName,
        start: seg.start,
        end: seg.end,
      })} (${getBpDisplayStr(segmentLength(seg))}${
        seg.strand === -1 ? ', inverted' : ''
      })`,
    }
    x += blockWidth + gap
    return block
  })
}

/**
 * The segment sizes in path order — `52.3Kbp, 199bp, 183bp inv, 8.43Kbp inv` —
 * which is the figure the caveat above the list actually points at. Past
 * `maxShown` segments the list stops being readable, so it collapses to the two
 * ends of the range, which still answers "are these all one read long".
 */
export function segmentSizeSummary(
  segments: DerivativeSegment[],
  maxShown = 6,
) {
  if (segments.length === 0) {
    return ''
  }
  if (segments.length > maxShown) {
    const lengths = segments.map(segmentLength)
    return `smallest ${getBpDisplayStr(
      Math.min(...lengths),
    )}, largest ${getBpDisplayStr(Math.max(...lengths))}`
  }
  return segments
    .map(
      seg =>
        `${getBpDisplayStr(segmentLength(seg))}${
          seg.strand === -1 ? ' inv' : ''
        }`,
    )
    .join(', ')
}
