import {
  ARC_SHAPE_ARC,
  ARC_SHAPE_FLAT,
  ARC_SHAPE_FLAT_SPLIT,
} from '../../features/arcs/compute.ts'
import { formatArcTooltip, supportLabel } from './tooltipUtils.ts'

import type { ArcHitResult } from '../../features/arcs/hitTest.ts'

function hit(
  support: number,
  {
    x1 = 1000,
    x2 = 2000,
    spanBp = 500,
    shapeType = ARC_SHAPE_ARC,
  }: {
    x1?: number
    x2?: number
    spanBp?: number
    shapeType?: number
  } = {},
): ArcHitResult {
  return {
    kind: 'arc',
    index: 0,
    x1,
    x2,
    support,
    colorType: 0,
    shapeType,
    spanBp,
  }
}

describe('formatArcTooltip', () => {
  test('reports the arc, ordered left to right whichever mate came first', () => {
    const payload = formatArcTooltip(
      hit(12, { x1: 2000, x2: 1000 }),
      'chr1',
      'Long insert',
    )
    expect(payload.support).toBe(12)
    expect(payload.category).toBe('Long insert')
    expect([payload.start, payload.end]).toEqual([1000, 2000])
  })

  test('the flat read-cloud line reports the insert size it plots', () => {
    // A curve's Y is the genomic radius, which just restates the span above it.
    expect(
      formatArcTooltip(hit(2, { shapeType: ARC_SHAPE_FLAT }), 'chr1', undefined)
        .insertSize,
    ).toBe(500)
    expect(
      formatArcTooltip(hit(2), 'chr1', undefined).insertSize,
    ).toBeUndefined()
  })

  // The shape the old `isFlatArcShape` gate got wrong. Both flat variants DRAW
  // as a bar, which is what that predicate is for, but only the mate link has a
  // template length: `computeArcShape` gives a split junction
  // `spanBp = |p2Bp - p1Bp|`, which is the span already on the Location and
  // Distance lines. So the row was the same number twice, the second time under
  // a name a split read cannot carry.
  test('a split junction has no insert size — its span is the breakpoint gap', () => {
    const split = hit(4, {
      x1: 1000,
      x2: 2700,
      spanBp: 1700,
      shapeType: ARC_SHAPE_FLAT_SPLIT,
    })
    const payload = formatArcTooltip(split, 'chr1', 'Split inversion')
    expect(payload.insertSize).toBeUndefined()
    // And the thing it would have reported is precisely the span it already
    // shows, which is why the duplicate row read as a real second measurement.
    expect(payload.end - payload.start).toBe(1700)
  })

  test('reports the true insert size, not the jittered Y it draws at', () => {
    // Read cloud scales a line's Y by a deterministic factor in [0.92, 1.08] so
    // coincident pairs separate on screen. Reading that position back reported
    // a 10,000bp template as 9,270bp — reproducibly, since the factor hashes
    // the endpoints, so it looked like a real number rather than a drawing
    // artifact. The hit no longer carries the drawn position at all, so this
    // now pins that `spanBp` is what survives to the tooltip.
    const jittered = hit(1, { spanBp: 10000, shapeType: ARC_SHAPE_FLAT })
    expect(formatArcTooltip(jittered, 'chr1', undefined).insertSize).toBe(10000)
  })
})

describe('supportLabel', () => {
  test('is singular at one read and plural above it', () => {
    expect(supportLabel(1)).toBe('Supported by 1 read')
    expect(supportLabel(2)).toBe('Supported by 2 reads')
    expect(supportLabel(1234)).toBe('Supported by 1,234 reads')
  })
})
