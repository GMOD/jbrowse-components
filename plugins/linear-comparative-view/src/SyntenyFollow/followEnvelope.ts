import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * The stretch of the other axis that EVERY alignment under the anchor window
 * maps to, taken together.
 *
 * This is the answer whenever the window is wider than the alignment it sits
 * on, and it exists because the single-block answer is catastrophically wrong
 * there. `resolveAlignmentSpan` and `interpolateFollowSpan` both CLAMP the
 * window to the block before mapping it — correctly, since a block says nothing
 * about sequence outside itself — so a window covering hundreds of short blocks
 * resolved to whichever one block overlapped it most, and the followed row
 * zoomed to that block's own width. Measured on the grape/peach MCScan demo: a
 * 27 Mb anchor window put the followed row on 12.7 kb, a 2131x mismatch, and the
 * effect got worse the further the anchor zoomed out.
 *
 * ONE TARGET CONTIG, chosen by summed overlap, then the union across it. A
 * genome-scale window overlaps blocks landing on several contigs of the other
 * assembly, and a union across all of them is not a place — it is the whole
 * genome. Taking the contig that most of the window aligns to is the same rule
 * `followAnchorWindow` uses to pick the anchor's own contig, and it degrades
 * the same way: with one contig involved it is a no-op.
 *
 * Interpolated per block rather than CIGAR-walked. At this zoom the answer is
 * an extent rather than a coordinate — the caller only uses this when the window
 * is NOT inside a single alignment, and where it is, the walk still runs.
 */
export function followEnvelope({
  data,
  window,
  toMate,
  mateAssembly,
}: {
  data: SyntenyFeatureData
  window: FollowWindow
  toMate: boolean
  mateAssembly?: string
}): ResolvedSpan | undefined {
  const refNames = toMate ? data.refNames : data.mateRefNames
  const starts = toMate ? data.starts : data.mateStarts
  const ends = toMate ? data.ends : data.mateEnds
  const otherRefNames = toMate ? data.mateRefNames : data.refNames
  const otherStarts = toMate ? data.mateStarts : data.starts
  const otherEnds = toMate ? data.mateEnds : data.ends

  // one pass to score the candidate target contigs, a second to union the
  // winner: the alternative is accumulating a span per contig and discarding
  // all but one, which is the same work plus a map allocation per fetch
  const overlapByRefName = new Map<string, number>()
  const overlapOf = (i: number) => {
    const lo = Math.min(starts[i]!, ends[i]!)
    const hi = Math.max(starts[i]!, ends[i]!)
    return Math.min(hi, window.end) - Math.max(lo, window.start)
  }
  const qualifies = (i: number) =>
    refNames[i] === window.refName &&
    (mateAssembly === undefined || data.mateAssemblyNames[i] === mateAssembly)

  for (let i = 0; i < refNames.length; i++) {
    if (qualifies(i) && overlapOf(i) > 0) {
      const key = otherRefNames[i]!
      overlapByRefName.set(key, (overlapByRefName.get(key) ?? 0) + overlapOf(i))
    }
  }
  let target: string | undefined
  let best = 0
  for (const [refName, overlap] of overlapByRefName) {
    if (overlap > best) {
      best = overlap
      target = refName
    }
  }
  if (target === undefined) {
    return undefined
  }

  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  for (let i = 0; i < refNames.length; i++) {
    if (!qualifies(i) || otherRefNames[i] !== target || overlapOf(i) <= 0) {
      continue
    }
    const aLo = Math.min(starts[i]!, ends[i]!)
    const aHi = Math.max(starts[i]!, ends[i]!)
    const bLo = Math.min(otherStarts[i]!, otherEnds[i]!)
    const bHi = Math.max(otherStarts[i]!, otherEnds[i]!)
    const aLen = aHi - aLo
    // the part of THIS block the window actually covers, mapped across it. A
    // block hanging far out of the window contributes only its overlapping
    // slice, so a single long block half in the window does not drag the
    // envelope out to its far end.
    const clipLo = Math.max(aLo, window.start)
    const clipHi = Math.min(aHi, window.end)
    const frac = (x: number) => (aLen > 0 ? (x - aLo) / aLen : 0)
    const reversed = data.strands[i] === -1
    const at = (f: number) =>
      reversed ? bHi - f * (bHi - bLo) : bLo + f * (bHi - bLo)
    const p = at(frac(clipLo))
    const q = at(frac(clipHi))
    lo = Math.min(lo, p, q)
    hi = Math.max(hi, p, q)
  }
  return lo <= hi
    ? {
        refName: target,
        start: Math.max(0, Math.floor(lo)),
        // at least one base, since a zero-width span assembles into an inverted
        // locstring
        end: Math.max(Math.floor(lo) + 1, Math.ceil(hi)),
      }
    : undefined
}
