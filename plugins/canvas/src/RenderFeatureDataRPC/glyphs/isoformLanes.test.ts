import { WHOLE_LANE, laneBudgetRows, laneShares } from './isoformLanes.ts'

import type { LaneItem } from './isoformLanes.ts'

function gene(featureId: string, startBp: number, endBp: number): LaneItem {
  return { featureId, startBp, endBp }
}

describe('laneShares', () => {
  it('gives a lone gene the whole lane', () => {
    expect(laneShares([gene('a', 100, 200)]).get('a')).toEqual(WHOLE_LANE)
  })

  it('counts genes that stack, not genes that fit beside each other', () => {
    const apart = laneShares([gene('a', 100, 200), gene('b', 300, 400)])
    expect(apart.get('a')).toEqual({ genes: 1 })
    expect(apart.get('b')).toEqual({ genes: 1 })

    const over = laneShares([gene('a', 100, 300), gene('b', 200, 400)])
    expect(over.get('a')).toEqual({ genes: 2 })
    expect(over.get('b')).toEqual({ genes: 2 })
  })

  // A long gene straddling many short ones overlaps all of them but only ever
  // stacks as deep as the busiest single column. Paying per overlap instead
  // would leave it one isoform in a lane with room for a dozen.
  it('charges the busiest point of a span, not every span it meets', () => {
    const shares = laneShares([
      gene('long', 0, 1000),
      gene('a', 100, 200),
      gene('b', 300, 400),
      gene('c', 500, 600),
      gene('d', 700, 800),
    ])
    expect(shares.get('long')).toEqual({ genes: 2 })
  })

  it('finds the deepest column when several genes pile up', () => {
    const shares = laneShares([
      gene('a', 0, 1000),
      gene('b', 100, 900),
      gene('c', 200, 800),
    ])
    expect(shares.get('a')).toEqual({ genes: 3 })
  })

  // A label overhang widens the packed span by an amount the worker cannot
  // measure, so two features meeting end to end are treated as stacking.
  it('treats touching spans as stacked', () => {
    const shares = laneShares([gene('a', 100, 200), gene('b', 200, 300)])
    expect(shares.get('a')).toEqual({ genes: 2 })
  })
})

describe('laneBudgetRows', () => {
  const geneOwnRows = 25 / 12

  // The lone-gene case must come back bit-identical, or every track without a
  // crowded lane silently re-collapses on the next fetch.
  it('hands a whole lane straight back', () => {
    for (const maxIsoforms of [1, 6, 14, 31, 64]) {
      expect(laneBudgetRows(maxIsoforms, geneOwnRows, WHOLE_LANE)).toBe(
        maxIsoforms,
      )
    }
  })

  it('splits the lane between the genes stacking in it', () => {
    expect(laneBudgetRows(31, geneOwnRows, { genes: 2 })).toBe(14)
    expect(laneBudgetRows(31, geneOwnRows, { genes: 3 })).toBe(8)
  })

  // A gene must not lose transcripts to a backdrop annotation. Charging
  // single-row neighbours shipped once and was reverted off a browser probe —
  // see `LaneShare`.
  it('ignores everything that is not a stacking gene', () => {
    expect(laneShares([gene('a', 100, 400)]).get('a')).toEqual({ genes: 1 })
    expect(laneBudgetRows(31, geneOwnRows, { genes: 1 })).toBe(31)
  })

  // However crowded the lane, a gene collapsed to nothing is not an overview of
  // it — the same floor `isoformRowBudget` and `isoformsWithinBudget` keep.
  it('never drops below one isoform', () => {
    expect(laneBudgetRows(6, geneOwnRows, { genes: 20 })).toBe(1)
  })

  it('is monotone in the number of genes', () => {
    const rows = (genes: number) => laneBudgetRows(60, geneOwnRows, { genes })
    expect(rows(1)).toBeGreaterThan(rows(2))
    expect(rows(2)).toBeGreaterThan(rows(3))
  })
})
