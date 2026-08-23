import type { LaneShare } from '../types.ts'

// One feature's claim on the lane: the span it packs into, and whether it is a
// gene that would spend the whole isoform budget on itself.
export interface LaneItem {
  featureId: string
  startBp: number
  endBp: number
  stacksIsoforms: boolean
}

// A gene with no measured neighbourhood owns the lane outright, which is what
// `maxIsoforms` already means — so this share reproduces the pre-sharing budget
// exactly (see laneBudgetRows).
export const WHOLE_LANE: LaneShare = { genes: 1, features: 0 }

/**
 * How many isoform rows one gene may spend, given what stacks beside it.
 *
 * `maxIsoforms` is the display's answer for a lane holding ONE gene: the track
 * height less that gene's own rows, divided by what an isoform row costs
 * (`isoformRowBudget`). So it is already net of one `geneOwnRows`, and every
 * further lane in the share owes its own — the second gene's padding and label
 * lines come out of the same track height the first one is filling.
 *
 * A plain feature costs `geneOwnRows + 1`: its own rows plus its single body,
 * which is exactly what `geneRowCostPx` prices a one-isoform gene at. So both
 * terms are the same arithmetic, and a lane of one gene and no neighbours
 * cancels back to `maxIsoforms` with no rounding at all.
 *
 * Floors at one isoform, like `isoformsWithinBudget` and `isoformRowBudget`
 * before it: a gene collapsed to nothing is not an overview of it, however
 * crowded its lane.
 *
 * An unpriced overhead (`geneOwnRows` undefined — a caller that set a cap
 * without one) still divides the lane; it just cannot charge each extra lane
 * the padding and label lines it will spend, so the shares come out a little
 * generous. The whole-lane answer is `maxIsoforms` either way, so the case this
 * degrades is exactly the case sharing improves.
 */
export function laneBudgetRows(
  maxIsoforms: number,
  geneOwnRows: number | undefined,
  share: LaneShare,
) {
  const ownRows = geneOwnRows === undefined ? 0 : geneOwnRows
  const spentByNeighbours =
    (share.genes - 1) * ownRows + share.features * (ownRows + 1)
  return Math.max(
    1,
    Math.floor((maxIsoforms - spentByNeighbours) / share.genes),
  )
}

interface LaneEvent {
  bp: number
  opens: boolean
  item: LaneItem
}

/**
 * Each stacking gene's busiest point, as a share of the lane.
 *
 * A sweep rather than a pairwise count, because those disagree on the shape
 * that matters: a long gene straddling twenty short ones overlaps twenty
 * features but only ever stacks three deep, and paying for twenty would leave
 * it one isoform in a lane with room for a dozen. The busiest single point
 * inside a gene's span is what the packer's deepest column actually costs.
 *
 * Counts are taken on opening events only — coverage cannot rise on a close —
 * and a span touching another end-to-end counts as stacked, since a label
 * overhang the worker cannot measure widens both (see `layoutEndBp` in
 * layout.ts). Both are the erring-toward-a-share direction, which is the one
 * that keeps names.
 *
 * Only genes get an entry: a plain feature has no isoform budget to divide.
 */
export function laneShares(items: LaneItem[]) {
  const events: LaneEvent[] = items.flatMap(item => [
    { bp: item.startBp, opens: true, item },
    { bp: item.endBp, opens: false, item },
  ])
  events.sort((a, b) => a.bp - b.bp || Number(b.opens) - Number(a.opens))

  const shares = new Map<string, LaneShare>()
  const openGenes = new Map<LaneItem, LaneShare>()
  let genes = 0
  let features = 0
  for (const { opens, item } of events) {
    if (opens) {
      if (item.stacksIsoforms) {
        genes++
        const share = { genes: 0, features: 0 }
        shares.set(item.featureId, share)
        openGenes.set(item, share)
      } else {
        features++
      }
      for (const share of openGenes.values()) {
        share.genes = Math.max(share.genes, genes)
        share.features = Math.max(share.features, features)
      }
    } else {
      if (item.stacksIsoforms) {
        genes--
        openGenes.delete(item)
      } else {
        features--
      }
    }
  }
  return shares
}
