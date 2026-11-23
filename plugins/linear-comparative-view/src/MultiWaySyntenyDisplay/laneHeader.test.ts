import {
  LABEL_FONT_SIZE,
  headerText,
  labelBoxTop,
  laneHeaderRows,
  laneRegion,
} from './laneHeader.ts'

import type { Lane } from './laneStack.ts'
import type { LaneChange, RowFrame } from './layoutMultiWay.ts'

// where a change sits on the anchor; no header reads it
const ON = { refName: 'chr1', start: 0, end: 1 }

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

// the whole frame matched to the window, unless a test says what is
const rowOf = (
  lane: Lane,
  visibleBpSpan = 2000,
  matchedOf: (
    lane: Lane,
  ) => { start: number; end: number } | undefined = laneRegion,
) =>
  laneHeaderRows(
    [anchorLane, lane],
    visibleBpSpan,
    'chr1:1..2,000',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    matchedOf,
  ).at(-1)!

test('the header never prints a negative coordinate', () => {
  const row = rowOf(mateLane({}))
  expect(row.label).toContain('Pp1:1..1,960')
  expect(row.label).not.toContain('-40')
})

test('the interval is the stretch matched to the window, not the frame drawn around it', () => {
  const row = rowOf(mateLane({}), 2000, () => ({ start: 300, end: 900 }))
  expect(row.label).toBe('peach  Pp1:301..900')
})

test('a lane with a frame and nothing matched to the window names no interval', () => {
  expect(rowOf(mateLane({}), 2000, () => undefined).label).toBe('peach')
})

describe('the label', () => {
  test('names the anchor lane by where the view is', () => {
    const row = laneHeaderRows([anchorLane], 2000, 'chr1:1..2,000')[0]!
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

  test('says the lane is reversed against the anchor where it is drawn flipped', () => {
    expect(rowOf(mateLane({ frame: { flipped: true } })).label).toBe(
      'peach  Pp1:1..1,960 reversed vs grape',
    )
  })

  test('names the contigs the lane is not showing', () => {
    const row = rowOf(mateLane({ frame: { alsoOn: ['Pp2', 'Pp5'] } }))
    expect(row.label).toBe('peach  Pp1:1..1,960')
    expect(row.alsoOn).toBe('· also on Pp2, Pp5')
    expect(headerText(row)).toBe('peach  Pp1:1..1,960  · also on Pp2, Pp5')
  })

  test('counts the contigs the cap left out rather than dropping them', () => {
    expect(
      rowOf(mateLane({ frame: { alsoOn: ['Pp2', 'Pp5'], alsoOnMore: 6 } }))
        .alsoOn,
    ).toBe('· also on Pp2, Pp5 and 6 more')
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
    const anchorRow = (span: number) =>
      laneHeaderRows([anchorLane], span, '')[0]!
    expect(anchorRow(2000).scale).toBe('2Kbp')
    expect(anchorRow(0).scale).toBe('')
    expect(anchorRow(2000).scaleTitle).toMatch(/^The span of the window/)
  })

  test('is nothing for a lane drawn at the anchor scale, or within rounding of it', () => {
    expect(rowOf(mateLane({}), 2000).scale).toBe('')
    expect(rowOf(mateLane({ frame: { min: 0, max: 2040 } }), 2000).scale).toBe(
      '',
    )
  })

  test('states how many times the lane is squeezed, and no bp figure of the frame', () => {
    expect(rowOf(mateLane({ frame: { min: 0, max: 3000 } }), 2000).scale).toBe(
      'squeezed 1.5×',
    )
    expect(
      rowOf(mateLane({ frame: { min: 0, max: 40_000 } }), 2000).scale,
    ).toBe('squeezed 20×')
  })

  test('reads the squeeze off the axis alone, holes and all', () => {
    const holed = mateLane({
      frame: { min: 0, max: 3000, openings: [{ at: 1000, bp: 500 }] },
    })
    const row = rowOf(holed, 2000)
    expect(row.scale).toBe('squeezed 1.5×')
    expect(row.scaleTitle).toBe(
      'This lane is drawn 1.5× smaller than the ruler.',
    )
  })

  test('prints nothing at the anchor scale, with a hole or without', () => {
    expect(
      rowOf(
        mateLane({
          frame: { min: 0, max: 2000, openings: [{ at: 1000, bp: 500 }] },
        }),
        2000,
      ).scale,
    ).toBe('')
  })

  test('explains itself in a hover title wherever it prints', () => {
    expect(
      rowOf(mateLane({ frame: { min: 0, max: 3000 } }), 2000).scaleTitle,
    ).toBe('This lane is drawn 1.5× smaller than the ruler.')
    expect(rowOf(mateLane({}), 2000).scaleTitle).toBeUndefined()
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
      'peach reversed vs the anchor',
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
    {
      at: 10_000,
      laneEnd: 10_000,
      laneBp: 0,
      anchorBp: 18_000,
      kind: 'deletion',
      anchor: ON,
    },
    {
      at: 50_000,
      laneEnd: 50_000,
      laneBp: 0,
      anchorBp: 30_000,
      kind: 'deletion',
      anchor: ON,
    },
    {
      at: 400_000,
      laneEnd: 400_000,
      laneBp: 0,
      anchorBp: 1_234_567,
      kind: 'deletion',
      anchor: ON,
    },
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
        {
          at: 20_000,
          laneEnd: 74_000,
          laneBp: 54_000,
          anchorBp: 0,
          kind: 'insertion',
          anchor: ON,
        },
        {
          at: 140_000,
          laneEnd: 151_000,
          laneBp: 11_000,
          anchorBp: 0,
          kind: 'insertion',
          anchor: ON,
        },
        {
          at: 300_000,
          laneEnd: 390_000,
          laneBp: 90_000,
          anchorBp: 0,
          kind: 'insertion',
          anchor: ON,
        },
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
        {
          at: 1000,
          laneEnd: 1000,
          laneBp: 0,
          anchorBp: 1_234_567,
          kind: 'deletion',
          anchor: ON,
        },
      ])[1]!.changes,
    ).toEqual({
      text: '1.23 Mb deletion',
      anchor: 'grape',
    })
  })

  test('names a stretch with bases on both sides as one replaced by the other', () => {
    expect(
      changesOf([
        {
          at: 20_000,
          laneEnd: 69_051,
          laneBp: 49_051,
          anchorBp: 121_555,
          kind: 'replacement',
          anchor: ON,
        },
        {
          at: 60_000,
          laneEnd: 154_146,
          laneBp: 94_146,
          anchorBp: 17,
          kind: 'replacement',
          anchor: ON,
        },
      ])[1]?.text,
    ).toBe('122 kb replaced by 49 kb, 17 bp replaced by 94 kb')
  })

  test('names an inversion the shown frame meets by its anchor span', () => {
    expect(
      changesOf([
        {
          at: 100_000,
          laneEnd: 1_000_000,
          laneBp: 900_000,
          anchorBp: 900_000,
          kind: 'inversion',
          anchor: ON,
        },
      ])[1]?.text,
    ).toBe('900 kb inversion')
  })

  test('is absent from the anchor and from a lane whose frame meets no change', () => {
    expect(
      laneHeaderRows([anchorLane, mateLane({})], 2000, '').map(
        row => row.changes,
      ),
    ).toEqual([undefined, undefined])
  })
})
