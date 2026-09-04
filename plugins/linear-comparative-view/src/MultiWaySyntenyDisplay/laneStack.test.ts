import { SimpleFeature } from '@jbrowse/core/util'

import {
  MIN_LANE_PITCH,
  buildLanes,
  laneContentHeight,
  laneGeometry,
} from './laneStack.ts'
import { groupFeatures } from './layoutMultiWay.ts'

import type { BuildLanesOpts } from './laneStack.ts'
import type { RowFrame, Span } from './layoutMultiWay.ts'

const WIDTH = 800
const HEIGHT = 240

function pairFeature(name: string, start: number, end: number) {
  return new SimpleFeature({
    uniqueId: `${name}-peach`,
    refName: 'chr1',
    start,
    end,
    strand: 1,
    name,
    assemblyName: 'grape',
    mate: {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: start + 1000,
      end: end + 1000,
      name: `p-${name}`,
    },
  })
}

const groups = groupFeatures([
  pairFeature('g1', 100, 200),
  pairFeature('g2', 300, 400),
])

const peachFrame: RowFrame = {
  refName: 'Pp1',
  min: 1000,
  max: 2000,
  flipped: false,
  alsoOn: [],
  fitMin: 1100,
  fitMax: 1400,
}

// the anchor lane's axis, standing in for the view's piecewise `bpToPx`: a
// linear map over chr1:0-1000 that CLIPS, the way `axisSpan` does
const axisSpanOf = (refName: string, start: number, end: number) =>
  refName === 'chr1'
    ? ([
        (Math.min(Math.max(start, 0), 1000) / 1000) * WIDTH,
        (Math.min(Math.max(end, 0), 1000) / 1000) * WIDTH,
      ] as Span)
    : undefined

function stack(overrides: Partial<BuildLanesOpts> = {}) {
  return buildLanes({
    assemblyNames: ['grape', 'peach'],
    groups,
    anchorSpans: new Map(
      groups.map(g => [
        g.key,
        axisSpanOf('chr1', g.anchor.start, g.anchor.end)!,
      ]),
    ),
    rowFrames: new Map([['peach', peachFrame]]),
    laneGenes: undefined,
    laneGeneAdapters: new Map([['grape', {}]]),
    axisSpanOf,
    refNameAliasOf: () => undefined,
    width: WIDTH,
    height: HEIGHT,
    ...overrides,
  })
}

test('the anchor lane is the top one, on the view axis rather than a frame', () => {
  const { lanes } = stack()
  expect(lanes.map(l => l.assemblyName)).toEqual(['grape', 'peach'])
  expect(lanes.map(l => l.isAnchor)).toEqual([true, false])
  expect(lanes[0]!.frame).toBeUndefined()
  expect(lanes[1]!.frame).toBe(peachFrame)
  expect(lanes[0]!.glyphTop).toBeLessThan(lanes[1]!.glyphTop)
})

test('each lane places the groups in its own coordinates', () => {
  const [anchor, peach] = stack().lanes
  // the anchor lane draws where the view draws: 100-200bp of chr1:0-1000 in 800px
  expect(anchor!.placements.get('g1')?.spans).toEqual([[80, 160]])
  // the mate lane draws through its frame: Pp1:1100-1200 of a 1000bp frame
  expect(peach!.placements.get('g1')?.spans).toEqual([[80, 160]])
  expect([...peach!.placements.keys()]).toEqual(['g1', 'g2'])
})

// A lane the visible groups place nothing on does not break the stack — the
// header, the band and the ticks still draw, and the next lane down still lines
// up against the last lane that had a frame.
test('a mate lane with no frame gets a lane and no spans', () => {
  const { lanes } = stack({ rowFrames: new Map() })
  expect(lanes).toHaveLength(2)
  expect(lanes[1]!.frame).toBeUndefined()
  expect(lanes[1]!.placements.size).toBe(0)
  expect(lanes[1]!.spanOf('Pp1', 1100, 1200)).toBeUndefined()
})

describe('the map a lane answers intervals with', () => {
  test('clips on the anchor lane rather than dropping a straddler', () => {
    const [anchor] = stack().lanes
    expect(anchor!.spanOf('chr1', 900, 1500)).toEqual([720, WIDTH])
    expect(anchor!.spanOf('Pp1', 100, 200)).toBeUndefined()
  })

  test('clips to the frame on a mate lane, and answers nothing off its contig', () => {
    const [, peach] = stack().lanes
    expect(peach!.spanOf('Pp1', 1900, 2500)).toEqual([720, WIDTH])
    expect(peach!.spanOf('Pp1', 3000, 4000)).toBeUndefined()
    expect(peach!.spanOf('Pp2', 1100, 1200)).toBeUndefined()
  })

  // A placement carries whatever refName the table's BED used and a gene
  // whatever that assembly's GFF3 used; for a genome whose annotation names
  // sequences by INSDC accession those are `CM028642.2` and `3L`.
  test('goes through the lane assembly own alias table', () => {
    const [, peach] = stack({
      refNameAliasOf: name =>
        name === 'peach'
          ? refName => (refName === 'CM1.2' ? 'Pp1' : refName)
          : undefined,
    }).lanes
    expect(peach!.spanOf('CM1.2', 1100, 1200)).toEqual([80, 160])
    expect(peach!.canon('CM1.2')).toBe('Pp1')
  })

  // The common case for a mate lane: the ortholog table names a genome the
  // session never loaded, so there is no alias table and the file's own
  // spelling has to pass through rather than resolving to nothing.
  test('passes a refName through for an assembly the session does not hold', () => {
    const [, peach] = stack().lanes
    expect(peach!.canon('Pp1')).toBe('Pp1')
    expect(peach!.spanOf('Pp1', 1100, 1200)).toEqual([80, 160])
  })
})

// `no annotation` in the header is a claim about the SESSION. Asked of this
// window's genes instead it would blink on and off as a lane panned across a
// gene desert.
test('whether a lane has an annotation is not whether this window drew one', () => {
  const { lanes } = stack({ laneGenes: new Map([['grape', []]]) })
  expect(lanes[0]!.hasAnnotation).toBe(true)
  expect(lanes[0]!.genes).toEqual([])
  expect(lanes[1]!.hasAnnotation).toBe(false)
})

test('a lane whose genes have not landed yet holds an empty list, not undefined', () => {
  expect(stack().lanes.every(l => Array.isArray(l.genes))).toBe(true)
})

describe('lane geometry', () => {
  // The bands are what stops the view's gridlines — true on the anchor lane
  // and a lie on every other one — at the anchor. A band covering only its own
  // header and glyphs left them standing in the gutters, which is most of the
  // ink in a tall track.
  test('the bands below the anchor tile without gaps', () => {
    const { rows } = laneGeometry(240, 4)
    for (const [row, band] of rows.entries()) {
      if (row > 0) {
        expect(band.bandStart).toBeCloseTo(rows[row - 1]!.bandEnd, 6)
        expect(band.bandStart).toBeLessThan(band.bandTop)
      }
    }
    expect(rows.at(-1)!.bandEnd).toBe(240)
  })

  test('every lane fits inside the stack, at any lane count', () => {
    for (const rowCount of [1, 2, 5, 12]) {
      const { glyphHeight, contentHeight, rows } = laneGeometry(240, rowCount)
      expect(rows).toHaveLength(rowCount)
      expect(rows[0]!.bandTop).toBeGreaterThanOrEqual(0)
      expect(rows.at(-1)!.glyphTop + glyphHeight).toBeLessThanOrEqual(
        contentHeight,
      )
    }
  })

  // The floor is a FLOOR, not a re-layout: at or above MIN_LANE_PITCH per lane
  // the stack is exactly the divide-the-height one and nothing scrolls.
  test('the pitch floor engages exactly where a lane falls under it', () => {
    expect(laneGeometry(10 * MIN_LANE_PITCH, 10).contentHeight).toBe(
      10 * MIN_LANE_PITCH,
    )
    expect(laneGeometry(10 * MIN_LANE_PITCH - 1, 10).contentHeight).toBe(
      10 * MIN_LANE_PITCH,
    )
    expect(laneContentHeight(240, 2)).toBe(240)
    expect(laneContentHeight(240, 20)).toBe(20 * MIN_LANE_PITCH)
  })

  test('below the floor the rows tile the fixed-pitch stack, not the track', () => {
    const { rows, contentHeight } = laneGeometry(240, 20)
    expect(contentHeight).toBe(20 * MIN_LANE_PITCH)
    expect(rows.at(-1)!.bandEnd).toBe(contentHeight)
    for (const [row, band] of rows.entries()) {
      if (row > 0) {
        expect(band.bandStart).toBeCloseTo(rows[row - 1]!.bandEnd, 6)
      }
    }
  })

  // Every committed multiway figure keeps today's layout byte-identically,
  // because each sits above the floor. The pairs are the corpus's
  // (website/scripts/specs/synteny.ts, height / lane count with the anchor):
  // grape 340/7, HPRC CFH 460/9, E. coli all-vs-all 340/5, grasses 320/5,
  // nightshades 320/5, flies 320/5, primates 620/8, and the tightest —
  // E. coli orthologs at 1100/47 ≈ 23.4 px per lane, which MIN_LANE_PITCH
  // sits just under.
  test('every figure in the corpus stays above the floor and does not scroll', () => {
    const corpus: [number, number][] = [
      [340, 7],
      [460, 9],
      [340, 5],
      [320, 5],
      [620, 8],
      [1100, 47],
    ]
    for (const [height, laneCount] of corpus) {
      expect(height / laneCount).toBeGreaterThanOrEqual(MIN_LANE_PITCH)
      expect(laneContentHeight(height, laneCount)).toBe(height)
    }
  })
})
