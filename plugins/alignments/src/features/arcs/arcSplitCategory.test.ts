import { connectionEndpointBps } from '@jbrowse/cigar-utils'

import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { arcCategoryColor } from '../../shaders/palettes.ts'
import { arcColorCategoryLabel } from '../../shared/legendUtils.ts'
import {
  COLOR_DEFAULT,
  COLOR_SPLIT_BACK,
  COLOR_SPLIT_FORWARD,
  COLOR_SPLIT_INV_LL,
  COLOR_SPLIT_INV_RR,
  getArcColorType,
} from './arcColors.ts'

import type { ArcColorField } from '../../shared/types.ts'
import type { PendingArc } from './arcTypes.ts'

type Segment = [start: number, end: number, strand: number]

// The junction between two read-adjacent segments, as `splitJunctionArc`
// builds it.
function junction([start1, end1, s1]: Segment, [start2, end2, s2]: Segment) {
  const { bp1, bp2, dir1, dir2 } = connectionEndpointBps({
    s1,
    start1,
    end1,
    s2,
    start2,
    end2,
    isSplit: true,
  })
  return {
    p1Ref: 'chr1',
    p1Bp: bp1,
    p1Strand: s1,
    p1Dir: dir1,
    p2Ref: 'chr1',
    p2Bp: bp2,
    p2Strand: s2,
    p2Dir: dir2,
    isSplit: true,
  } satisfies PendingArc
}

// The same molecule sequenced from its other end: the segments arrive in the
// opposite order, each on the opposite strand.
function fromOtherEnd(a: Segment, b: Segment) {
  const flip = ([start, end, strand]: Segment): Segment => [start, end, -strand]
  return junction(flip(b), flip(a))
}

function colorType(
  arc: PendingArc,
  colorField: ArcColorField = 'insertSizeAndOrientation',
) {
  return getArcColorType({ arc, colorField, hasPaired: false })
}

describe('split junction class', () => {
  const cases: [string, Segment, Segment, number][] = [
    [
      'a deletion jumps forward',
      [100, 200, 1],
      [500, 600, 1],
      COLOR_SPLIT_FORWARD,
    ],
    [
      'a tandem duplication jumps back',
      [400, 600, 1],
      [100, 300, 1],
      COLOR_SPLIT_BACK,
    ],
    [
      'an inversion entered from the left is LL-type',
      [100, 200, 1],
      [300, 500, -1],
      COLOR_SPLIT_INV_LL,
    ],
    [
      'an inversion left to the right is RR-type',
      [300, 500, -1],
      [600, 800, 1],
      COLOR_SPLIT_INV_RR,
    ],
  ]
  test.each(cases)('%s, read from either end', (_name, a, b, expected) => {
    expect(colorType(junction(a, b))).toBe(expected)
    expect(colorType(fromOtherEnd(a, b))).toBe(expected)
  })

  test('two feet on one base class the same from either end', () => {
    const a: Segment = [100, 200, 1]
    const b: Segment = [200, 300, 1]
    expect(junction(a, b).p1Bp).toBe(junction(a, b).p2Bp)
    expect(colorType(junction(a, b))).toBe(COLOR_SPLIT_FORWARD)
    expect(colorType(fromOtherEnd(a, b))).toBe(COLOR_SPLIT_FORWARD)
  })

  test('an unknown strand keeps the default slot', () => {
    expect(colorType(junction([100, 200, 0], [500, 600, 1]))).toBe(
      COLOR_DEFAULT,
    )
  })

  test('colouring by insert size leaves a junction uncoloured', () => {
    expect(
      colorType(junction([100, 200, 1], [500, 600, 1]), 'insertSize'),
    ).toBe(COLOR_DEFAULT)
  })
})

describe('split class colour', () => {
  const declared = makeTestPalette({
    readCategoryColors: {
      pairRL: [0.1, 0.2, 0.3],
      pairLL: [0.2, 0.3, 0.4],
      pairLR: [0.3, 0.4, 0.5],
      longInsert: [0.4, 0.5, 0.6],
    },
  })

  test('a class takes its pair twin colour, a declared one included', () => {
    expect(
      arcCategoryColor(declared, 'splitBack', 'insertSizeAndOrientation'),
    ).toEqual(declared.readCategoryColors.pairRL)
    expect(
      arcCategoryColor(declared, 'splitInvLL', 'insertSizeAndOrientation'),
    ).toEqual(declared.readCategoryColors.pairLL)
  })

  test('a forward jump follows a long-insert pair in each mode', () => {
    expect(
      arcCategoryColor(declared, 'splitForward', 'insertSizeAndOrientation'),
    ).toEqual(declared.readCategoryColors.longInsert)
    expect(
      arcCategoryColor(declared, 'splitForward', 'pairOrientation'),
    ).toEqual(declared.readCategoryColors.pairLR)
  })

  test('the hover names the split class, not its pair twin', () => {
    expect(arcColorCategoryLabel('splitBack', false)).toBe(
      'Split alignment (jumps back)',
    )
  })
})
