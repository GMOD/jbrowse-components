import { ARC_SHAPE_ARC } from '../../features/arcs/compute.ts'
import { formatArcTooltip, supportLabel } from './tooltipUtils.ts'

import type { ArcHitResult } from '../../features/arcs/hitTest.ts'

function hit(
  support: number,
  { x1 = 1000, x2 = 2000, yBp = 500, spanBp = 500 } = {},
): ArcHitResult {
  return {
    kind: 'arc',
    index: 0,
    x1,
    x2,
    support,
    colorType: 0,
    shapeType: ARC_SHAPE_ARC,
    yBp,
    spanBp,
  }
}

describe('formatArcTooltip', () => {
  test('reports the arc, ordered left to right whichever mate came first', () => {
    const payload = formatArcTooltip(
      hit(12, { x1: 2000, x2: 1000 }),
      'chr1',
      'Long insert',
      false,
    )
    expect(payload.support).toBe(12)
    expect(payload.category).toBe('Long insert')
    expect([payload.start, payload.end]).toEqual([1000, 2000])
  })

  test('the flat read-cloud line reports the insert size it plots', () => {
    // A curve's Y is the genomic radius, which just restates the span above it.
    expect(formatArcTooltip(hit(2), 'chr1', undefined, true).insertSize).toBe(
      500,
    )
    expect(
      formatArcTooltip(hit(2), 'chr1', undefined, false).insertSize,
    ).toBeUndefined()
  })

  test('reports the true insert size, not the jittered Y it draws at', () => {
    // Read cloud scales a line's Y by a deterministic factor in [0.92, 1.08] so
    // coincident pairs separate on screen. Reading that position back reported
    // a 10,000bp template as 9,270bp — reproducibly, since the factor hashes
    // the endpoints, so it looked like a real number rather than a drawing
    // artifact.
    const jittered = hit(1, { yBp: 9270, spanBp: 10000 })
    expect(formatArcTooltip(jittered, 'chr1', undefined, true).insertSize).toBe(
      10000,
    )
  })
})

describe('supportLabel', () => {
  test('is singular at one read and plural above it', () => {
    expect(supportLabel(1)).toBe('Supported by 1 read')
    expect(supportLabel(2)).toBe('Supported by 2 reads')
    expect(supportLabel(1234)).toBe('Supported by 1,234 reads')
  })
})
