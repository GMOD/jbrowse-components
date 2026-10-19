import { LABEL_FONT_SIZE, labelBoxTop, laneHeaderRows } from './laneHeader.ts'

import type { Lane } from './laneStack.ts'
import type { LaneChange, RowFrame } from './layoutMultiWay.ts'

const frame: RowFrame = {
  refName: 'Pp1',
  min: -40,
  max: 1960,
  flipped: false,
  fitMin: 0,
  fitMax: 1000,
  alsoOn: [],
  alsoOnMore: 0,
  alsoAt: [],
}

function mateLane(
  overrides: Omit<Partial<Lane>, 'frame'> & { frame?: Partial<RowFrame> },
) {
  const { frame: frameOverrides, ...rest } = overrides
  return {
    assemblyName: 'peach',
    label: 'peach',
    isAnchor: false,
    glyphTop: 40,
    layerTop: 40,
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
  label: 'grape',
  isAnchor: true,
  glyphTop: 12,
  layerTop: 12,
  canon: (ref: string) => ref,
  frame: undefined,
} as Lane

const rowOf = (lane: Lane, visibleBpSpan = 2000) =>
  laneHeaderRows([lane], visibleBpSpan, 'chr1:1..2,000')[0]!

test('the header never prints a negative coordinate', () => {
  const row = rowOf(mateLane({}))
  expect(row.label).toContain('Pp1:1..1,960')
  expect(row.label).not.toContain('-40')
})

describe('the label', () => {
  test('names the anchor lane by where the view is', () => {
    const row = rowOf(anchorLane)
    expect(row.label).toBe('grape  chr1:1..2,000')
    expect(row.isAnchor).toBe(true)
  })

  test('names a mate lane by its contig and range, through the alias table', () => {
    const row = rowOf(
      mateLane({
        canon: ref => (ref === 'Pp1' ? 'chr1' : ref),
        frame: { min: 1_234_567, max: 1_236_567 },
      }),
    )
    expect(row.label).toBe('peach  chr1:1,234,568..1,236,567')
    expect(row.isAnchor).toBe(false)
  })

  test('names the genome the way the session does', () => {
    expect(rowOf(mateLane({ label: 'Peach (prunus)' })).label).toBe(
      'Peach (prunus)  Pp1:1..1,960',
    )
  })

  test('says [rev] on a lane drawn flipped', () => {
    expect(rowOf(mateLane({ frame: { flipped: true } })).label).toBe(
      'peach  Pp1:1..1,960 [rev]',
    )
  })

  test('names the contigs the lane is not showing', () => {
    expect(rowOf(mateLane({ frame: { alsoOn: ['Pp2', 'Pp5'] } })).label).toBe(
      'peach  Pp1:1..1,960  · also on Pp2, Pp5',
    )
  })

  test('counts the contigs the cap left out rather than dropping them', () => {
    expect(
      rowOf(mateLane({ frame: { alsoOn: ['Pp2', 'Pp5'], alsoOnMore: 6 } }))
        .label,
    ).toBe('peach  Pp1:1..1,960  · also on Pp2, Pp5 and 6 more')
  })

  test('names the blocks of its contig the lane is not showing', () => {
    expect(
      rowOf(
        mateLane({
          frame: { alsoAt: [{ start: 35_000_000, end: 35_600_000 }] },
        }),
      ).label,
    ).toBe('peach  Pp1:1..1,960  · also at Pp1:35,000,001..35,600,000')
  })

  test('is the bare name for a mate lane the window places nothing on', () => {
    expect(rowOf(mateLane({ frame: undefined })).label).toBe('peach')
  })
})

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

test('each baseline sits just above its own layer bands, or its glyph row with none', () => {
  const lanes = [anchorLane, mateLane({})]
  const rows = laneHeaderRows(lanes, 2000, '')
  for (const [i, row] of rows.entries()) {
    expect(row.y).toBeLessThan(lanes[i]!.layerTop)
    expect(row.y).toBeGreaterThan(lanes[i]!.layerTop - 12)
  }
})

describe('a name on the gene row', () => {
  const inlineRow = (lane: Lane, glyphHeight: number) =>
    laneHeaderRows([lane], 2000, 'chr1:1..2,000', glyphHeight)[0]!

  test('prints the genome and its flip, without coordinates', () => {
    expect(inlineRow(mateLane({}), 10).label).toBe('peach')
    expect(inlineRow(mateLane({ frame: { flipped: true } }), 10).label).toBe(
      'peach [rev]',
    )
    expect(inlineRow(anchorLane, 10).label).toBe('grape')
  })

  test('is centred on a row taller than the text', () => {
    const lane = mateLane({})
    const top = labelBoxTop(inlineRow(lane, 18).y)
    expect(top).toBeCloseTo(lane.glyphTop + 4)
  })

  test('ends a pixel under a row shorter than the text', () => {
    const lane = mateLane({})
    const top = labelBoxTop(inlineRow(lane, 5).y)
    expect(top + LABEL_FONT_SIZE).toBeCloseTo(lane.glyphTop + 5 + 1)
  })
})

describe('the changes chip', () => {
  // in opened bp, so the frame shows lane bp 0..152,000 around two holes
  const lane = mateLane({
    frame: {
      min: 0,
      max: 200_000,
      openings: [
        { at: 10_000, bp: 18_000 },
        { at: 50_000, bp: 30_000 },
        { at: 400_000, bp: 1_234_567 },
      ],
    },
  })
  const deletions: LaneChange[] = [
    { at: 10_000, bp: 18_000, kind: 'deletion' },
    { at: 50_000, bp: 30_000, kind: 'deletion' },
    { at: 400_000, bp: 1_234_567, kind: 'deletion' },
  ]
  const changesOf = (changes: LaneChange[]) =>
    laneHeaderRows(
      [anchorLane, lane],
      2000,
      '',
      undefined,
      undefined,
      (assemblyName, refName) =>
        assemblyName === 'peach' && refName === 'Pp1' ? changes : [],
    ).map(row => row.changes)

  test('lists what the shown frame meets, largest first, two then a count', () => {
    expect(
      changesOf([
        ...deletions,
        { at: 20_000, bp: 54_000, kind: 'insertion' },
        { at: 140_000, bp: 11_000, kind: 'insertion' },
        { at: 300_000, bp: 90_000, kind: 'insertion' },
      ]),
    ).toEqual([
      undefined,
      { text: '54 kb insertion, 30 kb deletion, 2 more', anchor: 'grape' },
    ])
  })

  test('names two changes without a count, in the portal’s units', () => {
    expect(changesOf(deletions)[1]?.text).toBe('30 kb deletion, 18 kb deletion')
    const wide = mateLane({
      frame: {
        min: 0,
        max: 2_000_000,
        openings: [{ at: 1000, bp: 1_234_567 }],
      },
    })
    expect(
      laneHeaderRows([anchorLane, wide], 2000, '', undefined, undefined, () => [
        { at: 1000, bp: 1_234_567, kind: 'deletion' },
      ])[1]!.changes,
    ).toEqual({
      text: '1.2 Mb deletion',
      anchor: 'grape',
    })
  })

  test('is absent from the anchor and from a lane whose frame meets no change', () => {
    expect(
      laneHeaderRows([anchorLane, mateLane({})], 2000, '').map(
        row => row.changes,
      ),
    ).toEqual([undefined, undefined])
  })
})
