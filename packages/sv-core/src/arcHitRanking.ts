// Which arc the cursor is on, when several are near it — the ranking, with no
// geometry in it.
//
// It lives here because TWO arc stacks need exactly this rule and neither can
// use the other's geometry. `plugins/alignments` places conic domes and flat
// bars out of `ArcsUploadData` through the generated `arcRadiiPx`, against a
// genomic Y domain; `plugins/arc` places SVG semicircles and cubic beziers out
// of features, with no Y domain at all. The SHAPES share nothing, and the
// distances are computed by different solvers. What they share is the answer to
// "several marks are within tolerance, which one does the reader think they are
// pointing at", and that had one implementation and one set of hard-won
// tie-breaks. A second copy of it is the thing that drifts.

/**
 * How far outside its own stroke an arc still answers a hover, in CSS px.
 *
 * An arc is ink one to a few px wide over a band tens of px tall, so requiring
 * the cursor to be within the stroke itself makes the target a hairline and the
 * tooltip a thing you fish for. Callers add it to each mark's own half-width, so
 * a thicker arc grows its target the way it grows its ink, rather than every arc
 * getting one fixed-size hitbox.
 */
export const ARC_HIT_SLOP_PX = 3

/** One family's best answer, with how far outside its ink the cursor is. */
export interface ArcCandidate<T> {
  hit: T
  outside: number
}

/**
 * The ranking, which every arc family uses.
 *
 * ONE rule, and the clamp is what makes it one: every candidate the cursor is
 * literally ON ties at distance 0, so "nearest wins, later-painted breaks the
 * tie" says both halves of what used to be two buckets.
 *
 * ON THE INK — the strokes are opaque, so the answer is whichever mark is
 * painted ON TOP at that pixel. Feed candidates in paint order and scan
 * ascending, and that is the LAST candidate to tie at 0. Ranking these on
 * distance to the centre line instead reports whichever hairline the cursor is
 * nearest and throws away the target the per-mark tolerance had just widened —
 * which is exactly what the clamp throws away instead.
 *
 * Reading the paint order off the feed rather than re-deriving it is the point:
 * the alignments band used to rank on support, which was equivalent only while
 * support WAS the sort key. `resolveArcs` now sorts the arcs by category first,
 * so a lone discordant arc paints over a heavily-supported concordant one and a
 * support-ranked hover would have named the grey arc underneath.
 *
 * NEAR THE INK — reached only through `ARC_HIT_SLOP_PX`, so the cursor is over
 * blank band and the answer is a best guess. Nearest wins, measured from each
 * mark's own ink rather than its centre so a fat mark is not beaten by a
 * hairline it is visibly wider than. It cannot outrank an on-ink mark, 0 being
 * the floor, and `<=` breaks its own ties to the later-painted one too.
 *
 * One object per scan; the per-mark loops it serves still only write numbers.
 */
export function bestArcMark() {
  let index = -1
  let outside = Number.POSITIVE_INFINITY
  return {
    consider(i: number, dist: number) {
      if (dist > ARC_HIT_SLOP_PX) {
        return
      }
      // Clamped, not signed: how far INTO its stroke the cursor is says nothing
      // about which of two overlapping opaque marks the reader sees.
      const d = dist > 0 ? dist : 0
      if (d <= outside) {
        index = i
        outside = d
      }
    },
    // Builds the winner rather than handing back its index, so a caller with two
    // families to reconcile gets the `outside` that `pickBetween` compares and
    // one with a single family can pass the identity.
    best<T>(hitAt: (i: number) => T): ArcCandidate<T> | undefined {
      return index === -1 ? undefined : { hit: hitAt(index), outside }
    },
  }
}
