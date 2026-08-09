import { clampBlockToRegions } from './clampBlockToRegions.ts'

// A narrowed view — a `loc` naming a few kb, or a multi-locus view — makes the
// displayed region smaller than the alignment blocks in it, and the projection
// used to ask bpToCumBp per endpoint and drop any block with one outside. This
// is the cancer_sv/derivative_inserts case: four segments join in the
// derivative, and the 32.7 kb chr3 arm whose far end sits 32 kb off the left of
// its region was the one that never drew.
describe('clampBlockToRegions', () => {
  const chr3 = { r1Start: 25358900, r1End: 25359700 }
  const der3 = { r2Start: 32300, r2End: 33400 }

  test('leaves a block that fits both regions alone', () => {
    const c = clampBlockToRegions({
      a1: 25359000,
      b1: 25359500,
      ...chr3,
      a2: 32400,
      b2: 32900,
      ...der3,
    })
    expect(c).toEqual({
      a1: 25359000,
      b1: 25359500,
      a2: 32400,
      b2: 32900,
      trimmed: false,
    })
  })

  // The trim is driven by whichever axis runs out of region first, and BOTH
  // axes move together — clamping each on its own would leave the ribbon's top
  // edge pointing at a coordinate its bottom edge no longer matches.
  test('trims both axes proportionally when one runs off its region', () => {
    const c = clampBlockToRegions({
      a1: 25326821,
      b1: 25359568,
      ...chr3,
      a2: 0,
      b2: 32732,
      ...der3,
    })
    // der3 is the binding axis: t = 32300/32732 of the way along the block.
    const t = 32300 / 32732
    expect(c!.trimmed).toBe(true)
    expect(c!.a2).toBeCloseTo(32300, 6)
    expect(c!.b2).toBe(32732)
    expect(c!.a1).toBeCloseTo(25326821 + t * (25359568 - 25326821), 3)
    // and the trimmed endpoint is inside the region it was 32 kb outside of
    expect(c!.a1).toBeGreaterThanOrEqual(chr3.r1Start)
  })

  test('trims a - strand block on the pairing the ribbon draws', () => {
    // a1 is the block's genomic END for a - strand block, paired with a2
    const c = clampBlockToRegions({
      a1: 25359568,
      b1: 25326821,
      ...chr3,
      a2: 32732,
      b2: 0,
      ...der3,
    })
    expect(c!.a1).toBe(25359568)
    expect(c!.a2).toBe(32732)
    expect(c!.b2).toBeCloseTo(32300, 6)
    expect(c!.b1).toBeGreaterThanOrEqual(chr3.r1Start)
  })

  test('drops a block that overlaps neither region', () => {
    expect(
      clampBlockToRegions({
        a1: 100,
        b1: 200,
        ...chr3,
        a2: 100,
        b2: 200,
        ...der3,
      }),
    ).toBeUndefined()
  })

  // Both axes must be satisfiable at the SAME t, not merely each on its own:
  // here the query is in region over the first half and the target only over
  // the second, so there is no part of the block both views can show.
  test('drops a block whose axes are in region over disjoint spans', () => {
    // query in region over t <= 0.44, target only over t >= 0.61: each axis
    // shows part of the block, but no part of it is in view in both.
    expect(
      clampBlockToRegions({
        a1: 25358900,
        b1: 25360700,
        ...chr3,
        a2: 31200,
        b2: 33000,
        ...der3,
      }),
    ).toBeUndefined()
  })
})
