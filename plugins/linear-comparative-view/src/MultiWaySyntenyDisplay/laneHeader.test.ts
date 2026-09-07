import { laneHeaderRows } from './laneHeader.ts'

import type { Lane } from './laneStack.ts'
import type { RowFrame } from './layoutMultiWay.ts'

const frame: RowFrame = {
  refName: 'Pp1',
  min: -40,
  max: 1960,
  flipped: false,
  fitMin: 0,
  fitMax: 1000,
  alsoOn: [],
  alsoOnMore: 0,
}

function mateLane(
  overrides: Omit<Partial<Lane>, 'frame'> & { frame?: Partial<RowFrame> },
) {
  const { frame: frameOverrides, ...rest } = overrides
  return {
    assemblyName: 'peach',
    isAnchor: false,
    hasAnnotation: true,
    glyphTop: 40,
    canon: (ref: string) => ref,
    frame:
      'frame' in overrides && frameOverrides === undefined
        ? undefined
        : { ...frame, ...frameOverrides },
    ...rest,
  } as Lane
}

const anchorLane = {
  assemblyName: 'grape',
  isAnchor: true,
  hasAnnotation: true,
  glyphTop: 12,
  canon: (ref: string) => ref,
  frame: undefined,
} as Lane

const rowOf = (lane: Lane, visibleBpSpan = 2000) =>
  laneHeaderRows([lane], visibleBpSpan, 'chr1:1..2,000')[0]!

// A live pan derives a frame's min from the pivot unclamped, so content near a
// contig's start can put it below zero. The menu's locstring clamps
// (`laneLocString`); the header prints the same coordinate through the same
// `frameStartBp`.
test('the header never prints a negative coordinate', () => {
  const row = rowOf(mateLane({}))
  expect(row.label).toContain('Pp1:0')
  expect(row.label).not.toContain('-40')
})

describe('the label', () => {
  test('names the anchor lane by where the view is', () => {
    const row = rowOf(anchorLane)
    expect(row.label).toBe('grape  chr1:1..2,000')
    expect(row.isAnchor).toBe(true)
  })

  test('names a mate lane by its contig and start, through the alias table', () => {
    const row = rowOf(
      mateLane({
        canon: ref => (ref === 'Pp1' ? 'chr1' : ref),
        frame: { min: 1_234_567 },
      }),
    )
    expect(row.label).toBe('peach  chr1:1,234,567')
    expect(row.isAnchor).toBe(false)
  })

  test('says [rev] on a lane drawn flipped', () => {
    expect(rowOf(mateLane({ frame: { flipped: true } })).label).toBe(
      'peach  Pp1:0 [rev]',
    )
  })

  test('names the contigs the lane is not showing', () => {
    expect(rowOf(mateLane({ frame: { alsoOn: ['Pp2', 'Pp5'] } })).label).toBe(
      'peach  Pp1:0  · also on Pp2, Pp5',
    )
  })

  test('counts the contigs the cap left out rather than dropping them', () => {
    expect(
      rowOf(mateLane({ frame: { alsoOn: ['Pp2', 'Pp5'], alsoOnMore: 6 } }))
        .label,
    ).toBe('peach  Pp1:0  · also on Pp2, Pp5 and 6 more')
  })

  test('says so when the session holds no annotation for the lane', () => {
    expect(rowOf(mateLane({ hasAnnotation: false })).label).toBe(
      'peach  Pp1:0  · no annotation',
    )
  })

  test('is the bare name for a mate lane the window places nothing on', () => {
    expect(rowOf(mateLane({ frame: undefined })).label).toBe('peach')
  })
})

// The span, because a range makes the reader subtract two eight-digit numbers
// to answer "how zoomed is this lane", and the multiple only where it is not
// 1, so a stack at the anchor's own scale says so by staying quiet
describe('the scale', () => {
  test('is the visible span on the anchor lane', () => {
    expect(rowOf(anchorLane, 2000).scale).toBe('2Kbp')
    expect(rowOf(anchorLane, 0).scale).toBe('')
  })

  test('is the lane span alone at the anchor scale', () => {
    expect(rowOf(mateLane({}), 2000).scale).toBe('2Kbp')
  })

  test('stays quiet about a multiple within rounding of one', () => {
    expect(rowOf(mateLane({ frame: { min: 0, max: 2040 } }), 2000).scale).toBe(
      '2.04Kbp',
    )
  })

  test('states the multiple once the lane is zoomed out past the anchor', () => {
    expect(rowOf(mateLane({ frame: { min: 0, max: 3000 } }), 2000).scale).toBe(
      '3Kbp  1.5×',
    )
    expect(
      rowOf(mateLane({ frame: { min: 0, max: 40_000 } }), 2000).scale,
    ).toBe('40Kbp  20×')
  })

  test('is nothing for a lane without a frame', () => {
    expect(rowOf(mateLane({ frame: undefined })).scale).toBe('')
  })
})

test('each baseline sits just above its own glyph row', () => {
  const lanes = [anchorLane, mateLane({})]
  const rows = laneHeaderRows(lanes, 2000, '')
  for (const [i, row] of rows.entries()) {
    expect(row.y).toBeLessThan(lanes[i]!.glyphTop)
    expect(row.y).toBeGreaterThan(lanes[i]!.glyphTop - 12)
  }
})
