import { appendFileSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { SimpleFeature } from '@jbrowse/core/util'

import {
  copyLaneFiling,
  groupsOfField,
  laneFieldOf,
  laneGenome,
  laneOf,
} from './copyLane.ts'
import { decideLaneFrames, frameFromDecision } from './laneDecision.ts'
import { changeLabel } from './laneHeader.ts'
import { buildLanes, laneGeometry } from './laneStack.ts'
import {
  clipGroupToAnchor,
  frameBpPerPx,
  frameOpenings,
  groupFeatures,
  groupRunsOnRow,
  laneBpOfOpened,
  laneIndelsOf,
  rowAssembliesOf,
  rowFrameX,
} from './layoutMultiWay.ts'
import { SEQUENCE_BAR_PX, buildLaneCells } from './multiwayGeometry.ts'
import { PX_ORIGIN } from './multiwayRenderTypes.ts'

import type { LaneDecision } from './laneDecision.ts'
import type {
  MatePlacement,
  MultiWayGroup,
  RowFrame,
} from './layoutMultiWay.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

/**
 * One audit window of the hosted HPRC v2.1 walk file, its lane records as the
 * WalkTabixSyntenyAdapter answers a multi-way fetch: clipped to the window,
 * split at 10 kb gaps, each with its alignment ops
 */
interface HostedWindow {
  window: string
  region: { refName: string; start: number; end: number }
  records: (SimpleFeatureSerialized & { alignmentOps?: number[] })[]
}

function hostedWindow(name: string): HostedWindow {
  return JSON.parse(
    readFileSync(
      path.join(__dirname, 'test_data', 'hosted', `${name}.json`),
      'utf8',
    ),
  )
}

const WIDTH = 1400

// the hosted track's assemblyNames, the anchor first
const TRACK_GENOMES = [
  'hg38',
  'HG00097.1',
  'HG00099.1',
  'HG00128.1',
  'HG00133.1',
  'HG01109.1',
  'HG01123.1',
  'HG01960.1',
  'HG02055.1',
]

/**
 * The lanes a display draws of `hosted`, its window panned by `shift` bp,
 * read against the anchor as the walk file's header asks: the groups filed
 * by the field `auto` picks for a source declaring haplotype lanes, each
 * lane's decision and frame, and the anchor's px
 */
function layHosted(
  { region, records }: HostedWindow,
  {
    shift = 0,
    previous = new Map<string, LaneDecision | undefined>(),
  }: {
    shift?: number
    previous?: ReadonlyMap<string, LaneDecision | undefined>
  } = {},
) {
  const { refName } = region
  const start = region.start + shift
  const end = region.end + shift
  const unitBp = end - start
  const ops = new Map<string, Uint32Array>()
  const features = records
    .filter(record => !record.spansWindow)
    .map(({ alignmentOps, ...data }) => {
      const feature = new SimpleFeature(data)
      if (alignmentOps) {
        ops.set(feature.id(), Uint32Array.from(alignmentOps))
      }
      return feature
    })
  const fetched = groupFeatures(features)
  const inWindow = (g: MultiWayGroup) =>
    g.anchor.end > start && g.anchor.start < end
  const grouped = fetched
    .filter(inWindow)
    .map(group => clipGroupToAnchor(group, start, end, ops))
  const field = laneFieldOf(
    'auto',
    TRACK_GENOMES,
    name => name === 'hg38',
    true,
  )
  const { groups: filed } = groupsOfField(
    field,
    fetched,
    () => copyLaneFiling([], [], name => name, inWindow),
    unitBp,
  )
  const groups = filed
    .filter(inWindow)
    .map(group => clipGroupToAnchor(group, start, end, ops))
  const { openings, changes } = laneIndelsOf(filed)
  const lanes = rowAssembliesOf(groups, [])
  const px = (bp: number) => ((bp - start) / unitBp) * WIDTH
  const centre = (g: MultiWayGroup) => (g.anchor.start + g.anchor.end) / 2
  const decisions = decideLaneFrames({
    groups,
    assemblyNames: lanes,
    anchorX: new Map(groups.map(g => [g.key, px(centre(g))])),
    anchorCoordOf: g => ({ refName, coord: centre(g) }),
    pxOfAnchor: c => px(c.coord),
    unitBp,
    width: WIDTH,
    previous,
    openingsOf: openings,
    vsAnchor: true,
  })
  const frames = new Map<string, RowFrame>()
  for (const lane of lanes) {
    const d = decisions.get(lane)
    if (d) {
      frames.set(
        lane,
        frameFromDecision(
          d,
          px(d.pivotAnchor.coord),
          unitBp,
          WIDTH,
          false,
          openings(lane, d.refName, d.flipped),
        ),
      )
    }
  }
  return {
    field,
    grouped,
    groups,
    lanes,
    decisions,
    frames,
    openings,
    changes,
    ops,
    px,
  }
}

type Laid = ReturnType<typeof layHosted>

function unionBp(spans: { start: number; end: number }[]) {
  let bp = 0
  let reach = Number.NEGATIVE_INFINITY
  for (const { start, end } of spans.toSorted((a, b) => a.start - b.start)) {
    bp += Math.max(0, end - Math.max(start, reach))
    reach = Math.max(reach, end)
  }
  return bp
}

function pushTo<V>(map: Map<string, V[]>, key: string, value: V) {
  const list = map.get(key)
  if (list) {
    list.push(value)
  } else {
    map.set(key, [value])
  }
}

/**
 * The part of a placement a lane's frame shows, in lane bp and, in proportion
 * along it, in anchor bp; none where the lane runs it nowhere
 */
function shownPart(
  group: MultiWayGroup,
  lane: string,
  p: MatePlacement,
  frame: RowFrame | undefined,
) {
  const runs =
    frame &&
    groupRunsOnRow({ ...group, mates: new Map([[lane, [p]]]) }, lane, frame)
  if (!frame || !runs?.length) {
    return undefined
  }
  const openings = frameOpenings(frame)
  const lo = Math.max(p.start, laneBpOfOpened(openings, frame.min))
  const hi = Math.min(p.end, laneBpOfOpened(openings, frame.max))
  const perLane =
    (group.anchor.end - group.anchor.start) / Math.max(p.end - p.start, 1)
  const [head, tail] =
    p.orientation < 0 ? [p.end - hi, lo - p.start] : [lo - p.start, p.end - hi]
  return hi > lo
    ? {
        lane: hi - lo,
        anchor: {
          start: group.anchor.start + head * perLane,
          end: group.anchor.end - tail * perLane,
        },
      }
    : undefined
}

/**
 * Per genome, the anchor bp a record places some of it on and no lane of it
 * shows: what each lane's frame shows of each placement it runs, so a
 * placement hanging off the frame counts its part off it
 */
function undrawnAnchorBp({ grouped, groups, frames }: Laid) {
  const held = new Map<string, { start: number; end: number }[]>()
  const drawn = new Map<string, { start: number; end: number }[]>()
  for (const group of grouped) {
    for (const genome of group.mates.keys()) {
      pushTo(held, genome, group.anchor)
    }
  }
  for (const group of groups) {
    for (const [lane, placements] of group.mates) {
      for (const p of placements) {
        const part = shownPart(group, lane, p, frames.get(lane))
        if (part) {
          pushTo(drawn, laneGenome(lane), part.anchor)
        }
      }
    }
  }
  return new Map(
    [...held].map(([genome, spans]) => {
      const shown = drawn.get(genome) ?? []
      return [genome, unionBp(spans.concat(shown)) - unionBp(shown)]
    }),
  )
}

/**
 * Per genome, the bp of its own sequence a record places in the window and
 * no lane of it shows. A second copy over anchor another piece holds counts
 * here, where `undrawnAnchorBp` cannot see it
 */
function undrawnLaneBp({ groups, frames }: Laid) {
  const undrawn = new Map<string, number>()
  for (const group of groups) {
    for (const [lane, placements] of group.mates) {
      const genome = laneGenome(lane)
      for (const p of placements) {
        const part = shownPart(group, lane, p, frames.get(lane))
        undrawn.set(
          genome,
          (undrawn.get(genome) ?? 0) +
            Math.abs(p.end - p.start) -
            (part?.lane ?? 0),
        )
      }
    }
  }
  return undrawn
}

/** per genome, 3 px at each end of each of its lanes, in lane bp */
function pixelSlack({ frames }: Laid) {
  const slack = new Map<string, number>()
  for (const [lane, frame] of frames) {
    const genome = laneGenome(lane)
    slack.set(genome, (slack.get(genome) ?? 0) + 6 * frameBpPerPx(frame, WIDTH))
  }
  return slack
}

const lanesOf = (laid: ReturnType<typeof layHosted>, genome: string) =>
  laid.lanes.filter(lane => laneOf(lane).assemblyName === genome)

/** each lane of `genome` with the anchor stretches it draws */
function drawnBy(laid: ReturnType<typeof layHosted>, genome: string) {
  return lanesOf(laid, genome).map(lane => {
    const frame = laid.frames.get(lane)
    return {
      lane,
      refName: frame?.refName,
      anchors: laid.groups
        .filter(g => frame && groupRunsOnRow(g, lane, frame).length > 0)
        .map(g => [g.anchor.start, g.anchor.end]),
    }
  })
}

/** every placement of `genome` shown but for 3 px at each end of a lane */
function expectAllShown(laid: Laid, genome: string) {
  const slack = pixelSlack(laid).get(genome) ?? 0
  expect(undrawnAnchorBp(laid).get(genome) ?? 0).toBeLessThanOrEqual(slack)
  expect(undrawnLaneBp(laid).get(genome) ?? 0).toBeLessThanOrEqual(slack)
}

describe('every piece of a haplotype the window places is drawn', () => {
  test('SV-ins-10k-100k: one record across a 54 kb insertion draws both its runs', () => {
    const laid = layHosted(hostedWindow('SV-ins-10k-100k'))
    const drawn = drawnBy(laid, 'HG00097.1')
    expect(drawn).toHaveLength(1)
    expect(drawn[0]!.anchors).toContainEqual([24_001_842, 24_015_404])
    expectAllShown(laid, 'HG00097.1')
  })

  test('R1M-06: a reversed piece 4 Mb along the contig is a row of its own', () => {
    const laid = layHosted(hostedWindow('R1M-06'))
    const drawn = drawnBy(laid, 'HG00097.1')
    expect(drawn.map(d => d.refName)).toEqual(['CM094064.1', 'CM094064.1'])
    expect(drawn[1]!.anchors).toEqual([[12_338_568, 12_720_513]])
    expect(laid.frames.get(drawn[0]!.lane)!.flipped).toBe(true)
    expectAllShown(laid, 'HG00097.1')
  })

  test('H-SMN: a haplotype on two contigs draws a row for each', () => {
    const laid = layHosted(hostedWindow('H-SMN'))
    expect(
      drawnBy(laid, 'HG01109.1')
        .map(d => d.refName)
        .sort(),
    ).toEqual(['JAHEPA020000001.1', 'JAHEPA020000070.1'])
    expectAllShown(laid, 'HG01109.1')
  })

  test.each(['SV-ins-10k-100k', 'H-SMN', 'R1M-06', 'H-MAPT'])(
    '%s: a pan with the previous decisions held keeps every piece in its frame',
    name => {
      const hosted = hostedWindow(name)
      const { start, end } = hosted.region
      let laid = layHosted(hosted)
      for (const shift of [0.1, 0.2, 0.3, 0.2, 0]) {
        laid = layHosted(hosted, {
          shift: Math.round((end - start) * shift),
          previous: laid.decisions,
        })
        for (const genome of new Set(laid.lanes.map(laneGenome))) {
          expectAllShown(laid, genome)
        }
      }
    },
  )

  test('the counts fail where a placement hangs off its frame', () => {
    const laid = layHosted(hostedWindow('SV-ins-10k-100k'))
    const [lane] = lanesOf(laid, 'HG00097.1')
    const frame = laid.frames.get(lane!)!
    const cut = (frame.max - frame.min) / 4
    laid.frames.set(lane!, { ...frame, min: frame.min + cut })
    expect(undrawnLaneBp(laid).get('HG00097.1')).toBeGreaterThan(cut / 2)
    expect(undrawnAnchorBp(laid).get('HG00097.1')).toBeGreaterThan(cut / 4)
  })

  test('H-GSTM1: a haplotype 45 bp longer than the 50 kb window stays at 1×', () => {
    const laid = layHosted(hostedWindow('H-GSTM1'))
    for (const genome of ['HG00128.1', 'HG01960.1']) {
      const [lane] = lanesOf(laid, genome)
      expect(laid.decisions.get(lane!)?.rung).toBe(1)
      expectAllShown(laid, genome)
    }
  })

  test('the counts fail where a lane is left undrawn', () => {
    const laid = layHosted(hostedWindow('H-SMN'))
    const [dropped] = lanesOf(laid, 'HG01109.1')
    laid.frames.delete(dropped!)
    expect(undrawnAnchorBp(laid).get('HG01109.1')).toBeGreaterThan(100_000)
    expect(undrawnLaneBp(laid).get('HG01109.1')).toBeGreaterThan(100_000)
  })
})

/** each lane of `genome`'s stated changes, as its header words them */
function chipsOf(laid: ReturnType<typeof layHosted>, genome: string) {
  return lanesOf(laid, genome).flatMap(lane => {
    const frame = laid.frames.get(lane)
    return frame
      ? laid.changes(lane, frame.refName, frame.flipped).map(changeLabel)
      : []
  })
}

// Records cut as jbrowse-components' splitSyntenyFeatureAtGaps cuts them since
// 48e3d77f08, an indel beside a cut counted in its gap
describe('a gap with bases on both sides is worded by both, at its size', () => {
  test('F2-chr3: HG01960#1 replaces 114 kb of GRCh38 with 8 bp of its own', () => {
    expect(chipsOf(layHosted(hostedWindow('F2-chr3')), 'HG01960.1')).toEqual([
      '114 kb replaced by 8 bp',
    ])
  })

  test('SV-rep-10k-100k: HG02055#1 replaces 13 kb with 13 bp', () => {
    expect(
      chipsOf(layHosted(hostedWindow('SV-rep-10k-100k')), 'HG02055.1'),
    ).toEqual(['13 kb replaced by 13 bp'])
  })
})

/**
 * The bars and dashed joins a lane of `genome` draws under its ribbons, in
 * lane px, with the session holding no assembly of it
 */
function sequenceMarks(laid: ReturnType<typeof layHosted>, genome: string) {
  const [laneName] = lanesOf(laid, genome)
  const stack = buildLanes({
    assemblyNames: ['hg38', ...laid.lanes],
    groups: laid.groups,
    anchorSpans: new Map(
      laid.groups.map(g => [
        g.key,
        [laid.px(g.anchor.start), laid.px(g.anchor.end)],
      ]),
    ),
    rowFrames: laid.frames,
    axisSpanOf: (_ref, start, end) => [laid.px(start), laid.px(end)],
    axisSpansOf: (_ref, start, end) => [[laid.px(start), laid.px(end)]],
    anchorRegionSpans: [],
    anchorBpPerPx: 1,
    contigOf: () => undefined,
    refNameAliasOf: () => undefined,
    width: WIDTH,
    geometry: laneGeometry(800, 1 + laid.lanes.length),
  })
  const lane = stack.lanes.find(l => l.assemblyName === laneName)!
  const fills = { fill: () => ({ css: 'gold', packed: 0 }), utr: () => 0 }
  const { glyphs } = buildLaneCells({
    lane,
    genes: [],
    glyphHeight: stack.glyphHeight,
    width: WIDTH,
    colors: {
      genes: fills,
      boxes: fills,
      stroke: '#222',
      divider: '#ccc',
      sequence: '#888',
    },
  })
  const rects = Array.from({ length: glyphs.rectHeights.length }, (_, i) => ({
    x1: glyphs.rectPositions[2 * i]! - PX_ORIGIN,
    x2: glyphs.rectPositions[2 * i + 1]! - PX_ORIGIN,
    height: glyphs.rectHeights[i]!,
  }))
  const frame = laid.frames.get(laneName!)!
  return {
    bars: rects.filter(r => r.height === SEQUENCE_BAR_PX),
    dashes: rects.filter(r => r.height === 1),
    x: (bp: number) => rowFrameX(frame, bp, WIDTH),
    bpPerPx: frameBpPerPx(frame, WIDTH),
  }
}

describe('a lane draws its own sequence, and a dashed join across a hole', () => {
  // HG00097#1 replaces 122 kb of GRCh38 with 49 kb of its own, between its
  // walk's two records: a 72.5 kb hole, then the 49 kb no ribbon pairs
  test('H-AMY1: the bar covers the 49 kb, and the dashes the hole', () => {
    const { bars, dashes, x, bpPerPx } = sequenceMarks(
      layHosted(hostedWindow('H-AMY1')),
      'HG00097.1',
    )
    expect(bars).toHaveLength(2)
    const [left, right] = bars.toSorted((a, b) => a.x1 - b.x1)
    expect(left!.x2).toBeCloseTo(x(104_117_700), 0)
    expect(right!.x2 - right!.x1).toBeGreaterThan(
      (104_214_116 - 104_117_700) / bpPerPx - 2,
    )
    expect(
      dashes.reduce((least, d) => Math.min(least, d.x1), Infinity),
    ).toBeCloseTo(left!.x2, 0)
    expect(dashes.reduce((most, d) => Math.max(most, d.x2), 0)).toBeCloseTo(
      right!.x1,
      0,
    )
    expect((right!.x1 - left!.x2) * bpPerPx).toBeCloseTo(121_555 - 49_051, -2)
  })

  test('H-AMY1: a hole running off past the stack still draws its dashes to the edge', () => {
    const laid = layHosted(hostedWindow('H-AMY1'))
    const [lane] = lanesOf(laid, 'HG00097.1')
    const frame = laid.frames.get(lane!)!
    const span = 50_000
    const min = 104_117_700 - 0.6 * span
    laid.frames.set(lane!, { ...frame, min, max: min + span })
    const { bars, dashes } = sequenceMarks(laid, 'HG00097.1')
    expect(bars).toHaveLength(1)
    expect(dashes.length).toBeGreaterThan(0)
    expect(dashes.reduce((most, d) => Math.max(most, d.x2), 0)).toBeGreaterThan(
      2 * WIDTH - 7,
    )
  })

  // HG00099#1 holds 33 kb GRCh38 lacks, then lacks 33 kb GRCh38 holds
  test('H-C4: one bar runs on under no ribbon, and one dashed join crosses the deletion', () => {
    const { bars, dashes } = sequenceMarks(
      layHosted(hostedWindow('H-C4')),
      'HG00099.1',
    )
    expect(bars).toHaveLength(2)
    expect(dashes.length).toBeGreaterThan(0)
    const [, right] = bars.toSorted((a, b) => a.x1 - b.x1)
    expect(
      dashes.reduce((least, d) => Math.min(least, d.x1), Infinity),
    ).toBeLessThan(right!.x1)
  })

  // HG00097#1's walk starts 69% into the window, and its contig before that
  // is not loaded here
  test('R1M-05: no bar past what the records place', () => {
    const { bars, x } = sequenceMarks(
      layHosted(hostedWindow('R1M-05')),
      'HG00097.1',
    )
    expect(bars).toHaveLength(1)
    expect(bars[0]!.x1).toBeCloseTo(x(13_092_427), 0)
    expect(bars[0]!.x2).toBeCloseTo(x(13_404_348), 0)
  })
})

// records A and B flank 300 kb of the anchor that record C places, on the
// contig 5 Mb on or on another contig
describe('a gap whose anchor another piece of the haplotype places', () => {
  const record = (
    id: string,
    anchor: [number, number],
    contig: string,
    lane: number,
    recordId = id,
  ) => ({
    uniqueId: id,
    recordId,
    refName: 'chr1',
    start: anchor[0],
    end: anchor[1],
    strand: 1,
    assemblyName: 'hg38',
    mate: {
      assemblyName: 'HG00097.1',
      refName: contig,
      start: lane,
      end: lane + anchor[1] - anchor[0],
    },
  })
  test.each([
    ['5 Mb on along the contig', 'ctg', 5_000_000, 'B'],
    ['on another contig', 'other', 0, 'B'],
    ['on another contig, A and B one record', 'other', 0, 'A'],
  ])('states no deletion, C %s', (_, contig, lane, recordB) => {
    const laid = layHosted({
      window: 'ABC',
      region: { refName: 'chr1', start: 0, end: 500_000 },
      records: [
        record('A', [0, 100_000], 'ctg', 0),
        record('B', [400_000, 500_000], 'ctg', 100_000, recordB),
        record('C', [100_000, 400_000], contig, lane),
      ],
    })
    expect(lanesOf(laid, 'HG00097.1')).toHaveLength(2)
    expect(chipsOf(laid, 'HG00097.1')).toEqual([])
    for (const lane of lanesOf(laid, 'HG00097.1')) {
      expect(laid.openings(lane, laneOf(lane).refName!)).toEqual(
        recordB === 'A' && laneOf(lane).refName === 'ctg'
          ? [{ at: 100_000, bp: 300_000 }]
          : [],
      )
    }
    expectAllShown(laid, 'HG00097.1')
  })
})

describe('a gap holding a piece of the other strand states nothing', () => {
  test('H-MAPT: HG01123#1 states its inversion and the gaps between its inverted pieces, and nothing at the breakpoints', () => {
    expect(chipsOf(layHosted(hostedWindow('H-MAPT')), 'HG01123.1')).toEqual([
      '147 bp replaced by 35 kb',
      '29 kb insertion',
      '866 kb inversion',
    ])
  })

  test('H-SMN: HG00133#1 states the insertions between its pieces, and no 1 Mb replaced by 43 kb', () => {
    expect(chipsOf(layHosted(hostedWindow('H-SMN')), 'HG00133.1')).toEqual([
      '20 kb insertion',
      '41 kb insertion',
      '102 kb insertion',
    ])
  })

  test('verified chips stand: C4 33 kb insertion and amylase 94 kb deletion', () => {
    expect(chipsOf(layHosted(hostedWindow('H-C4')), 'HG00099.1')).toEqual([
      '33 kb insertion',
      '33 kb deletion',
    ])
    expect(chipsOf(layHosted(hostedWindow('H-AMY1')), 'HG00133.1')).toEqual([
      '94 kb deletion',
    ])
  })
})

// HOSTED_DUMPS names a folder of every audit window's records, written as
// test_data/hosted is, and HOSTED_REPORT a file each window's count is
// appended to; without them this reads none
const dumps = process.env.HOSTED_DUMPS
const report = process.env.HOSTED_REPORT
const allWindows = dumps
  ? readdirSync(dumps)
      .filter(name => name.endsWith('.json'))
      .map(name => name.slice(0, -5))
  : []
const describeDumps = dumps ? describe : describe.skip

describeDumps('every audit window', () => {
  test.each(allWindows.length ? allWindows : ['none'])(
    '%s draws every haplotype wherever a record places it',
    name => {
      const hosted: HostedWindow = JSON.parse(
        readFileSync(path.join(dumps!, `${name}.json`), 'utf8'),
      )
      const laid = layHosted(hosted)
      const anchor = Object.fromEntries(undrawnAnchorBp(laid))
      const lane = Object.fromEntries(undrawnLaneBp(laid))
      if (report) {
        appendFileSync(
          report,
          `${name}\t${JSON.stringify(anchor)}\t${JSON.stringify(lane)}\n`,
        )
      }
      for (const genome of Object.keys(anchor)) {
        expectAllShown(laid, genome)
      }
    },
  )
})
