import { ARC_SHAPE_ARC } from '../../features/arcs/compute.ts'
import { formatArcTooltip, supportLabel } from './tooltipUtils.ts'

import type { ArcHit, ArcHitResult } from '../../features/arcs/hitTest.ts'

function hit(
  support: number,
  { x1 = 1000, x2 = 2000, colorType = 0 } = {},
): ArcHit {
  return {
    index: 0,
    x1,
    x2,
    support,
    colorType,
    shapeType: ARC_SHAPE_ARC,
    yBp: 500,
  }
}

function result(support: number, coincident: ArcHit[] = []): ArcHitResult {
  return { ...hit(support), coincident }
}

// The color bucket each arc classified into, as the display resolves it. Named
// per slot so a payload that reused the winner's label for everything would be
// visible rather than plausible.
const categoryOf = (colorType: number) => `bucket${colorType}`

describe('formatArcTooltip', () => {
  test('an ordinary hover reports one arc and no list', () => {
    const payload = formatArcTooltip(result(12), 'chr1', categoryOf, false)
    expect(payload.support).toBe(12)
    expect(payload.category).toBe('bucket0')
    expect(payload.coincident).toEqual([])
    expect(payload.coincidentHidden).toBe(0)
  })

  test('each coincident arc gets its OWN category and span', () => {
    const payload = formatArcTooltip(
      result(12, [
        hit(3, { x1: 1000, x2: 2689, colorType: 4 }),
        hit(1, { x1: 1002, x2: 2000, colorType: 7 }),
      ]),
      'chr1',
      categoryOf,
      false,
    )
    expect(payload.coincident).toEqual([
      { support: 3, category: 'bucket4', span: 'chr1:1,001-2,689' },
      { support: 1, category: 'bucket7', span: 'chr1:1,003-2,000' },
    ])
    expect(payload.coincidentHidden).toBe(0)
  })

  // A dense read cloud can put a dozen flat lines under one cursor, and a
  // tooltip tall enough to list them covers the arcs it is describing.
  test('past the third, the rest are counted rather than named', () => {
    const payload = formatArcTooltip(
      result(12, [hit(5), hit(4), hit(3), hit(2), hit(1)]),
      'chr1',
      categoryOf,
      false,
    )
    expect(payload.coincident.map(o => o.support)).toEqual([5, 4, 3])
    expect(payload.coincidentHidden).toBe(2)
  })

  test('the flat read-cloud line still reports the insert size it plots', () => {
    expect(
      formatArcTooltip(result(2), 'chr1', categoryOf, true).insertSize,
    ).toBe(500)
    expect(
      formatArcTooltip(result(2), 'chr1', categoryOf, false).insertSize,
    ).toBeUndefined()
  })
})

// One wording for the count, so the hovered arc's line and the coincident arcs
// listed under it can be read against each other.
describe('supportLabel', () => {
  test('is singular at one read and plural above it', () => {
    expect(supportLabel(1)).toBe('Supported by 1 read')
    expect(supportLabel(2)).toBe('Supported by 2 reads')
    expect(supportLabel(1234)).toBe('Supported by 1,234 reads')
  })
})
