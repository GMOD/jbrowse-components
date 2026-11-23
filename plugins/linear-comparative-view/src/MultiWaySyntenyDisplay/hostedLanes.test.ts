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
import {
  clipGroupToAnchor,
  groupFeatures,
  groupRunsOnRow,
  laneIndelsOf,
  rowAssembliesOf,
} from './layoutMultiWay.ts'

import type { MultiWayGroup, RowFrame } from './layoutMultiWay.ts'
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
 * The lanes a display draws of `hosted` at its whole window, read against
 * the anchor as the walk file's header asks: the groups filed by the field
 * `auto` picks for a source declaring haplotype lanes, each lane's frame, and
 * the anchor's px
 */
function layHosted({ region, records }: HostedWindow) {
  const { refName, start, end } = region
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
  const grouped = groupFeatures(features).map(group =>
    clipGroupToAnchor(group, start, end, ops),
  )
  const field = laneFieldOf(
    'auto',
    TRACK_GENOMES,
    name => name === 'hg38',
    true,
  )
  const { groups } = groupsOfField(
    field,
    grouped,
    () => copyLaneFiling([], [], name => name),
    unitBp,
  )
  const { openings, changes } = laneIndelsOf(groups)
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
    previous: new Map(),
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
  return { field, grouped, groups, lanes, frames, openings, changes, ops }
}

function unionBp(spans: { start: number; end: number }[]) {
  let bp = 0
  let reach = Number.NEGATIVE_INFINITY
  for (const { start, end } of spans.toSorted((a, b) => a.start - b.start)) {
    bp += Math.max(0, end - Math.max(start, reach))
    reach = Math.max(reach, end)
  }
  return bp
}

/**
 * Per genome, the anchor bp a record places some of it on and no lane of it
 * draws: a group's anchor counts drawn where a lane of the genome runs one of
 * its placements in its frame (`groupRunsOnRow`), as a ribbon needs
 */
function undrawnAnchorBp({
  grouped,
  groups,
  frames,
}: Pick<ReturnType<typeof layHosted>, 'grouped' | 'groups' | 'frames'>) {
  const held = new Map<string, { start: number; end: number }[]>()
  const drawn = new Map<string, { start: number; end: number }[]>()
  const add = (
    map: Map<string, { start: number; end: number }[]>,
    genome: string,
    span: { start: number; end: number },
  ) => {
    const spans = map.get(genome)
    if (spans) {
      spans.push(span)
    } else {
      map.set(genome, [span])
    }
  }
  for (const group of grouped) {
    for (const genome of group.mates.keys()) {
      add(held, genome, group.anchor)
    }
  }
  for (const group of groups) {
    for (const lane of group.mates.keys()) {
      const frame = frames.get(lane)
      if (frame && groupRunsOnRow(group, lane, frame).length > 0) {
        add(drawn, laneGenome(lane), group.anchor)
      }
    }
  }
  return new Map(
    [...held].map(([genome, spans]) => {
      const shown = drawn.get(genome) ?? []
      return [genome, unionBp([...spans, ...shown]) - unionBp(shown)]
    }),
  )
}

/**
 * Per genome, the bp of its own sequence a record places in the window and
 * no lane of it draws: a placement counts drawn where a lane holding it runs
 * it in its frame. A second copy over anchor another piece holds is counted
 * here, where `undrawnAnchorBp` cannot see it
 */
function undrawnLaneBp({
  groups,
  frames,
}: Pick<ReturnType<typeof layHosted>, 'groups' | 'frames'>) {
  const placed = new Map<string, number>()
  const undrawn = new Map<string, number>()
  for (const group of groups) {
    for (const [lane, placements] of group.mates) {
      const genome = laneGenome(lane)
      const frame = frames.get(lane)
      for (const p of placements) {
        const bp = Math.abs(p.end - p.start)
        const drawn =
          frame &&
          groupRunsOnRow(
            { ...group, mates: new Map([[lane, [p]]]) },
            lane,
            frame,
          ).length > 0
        placed.set(genome, (placed.get(genome) ?? 0) + bp)
        undrawn.set(genome, (undrawn.get(genome) ?? 0) + (drawn ? 0 : bp))
      }
    }
  }
  return new Map(
    [...placed.keys()].map(genome => [genome, undrawn.get(genome) ?? 0]),
  )
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

describe('every piece of a haplotype the window places is drawn', () => {
  test('SV-ins-10k-100k: one record across a 54 kb insertion draws both its runs', () => {
    const laid = layHosted(hostedWindow('SV-ins-10k-100k'))
    const drawn = drawnBy(laid, 'HG00097.1')
    expect(drawn).toHaveLength(1)
    expect(drawn[0]!.anchors).toContainEqual([24_001_842, 24_015_404])
    expect(undrawnAnchorBp(laid).get('HG00097.1')).toBe(0)
  })

  test('R1M-06: a reversed piece 4 Mb along the contig is a row of its own', () => {
    const laid = layHosted(hostedWindow('R1M-06'))
    const drawn = drawnBy(laid, 'HG00097.1')
    expect(drawn.map(d => d.refName)).toEqual(['CM094064.1', 'CM094064.1'])
    expect(drawn[1]!.anchors).toEqual([[12_338_568, 12_720_513]])
    expect(laid.frames.get(drawn[0]!.lane)!.flipped).toBe(true)
    expect(undrawnAnchorBp(laid).get('HG00097.1')).toBe(0)
  })

  test('H-SMN: a haplotype on two contigs draws a row for each', () => {
    const laid = layHosted(hostedWindow('H-SMN'))
    expect(
      drawnBy(laid, 'HG01109.1')
        .map(d => d.refName)
        .sort(),
    ).toEqual(['JAHEPA020000001.1', 'JAHEPA020000070.1'])
    expect(undrawnAnchorBp(laid).get('HG01109.1')).toBe(0)
  })

  test('the counts fail where a lane is left undrawn', () => {
    const laid = layHosted(hostedWindow('H-SMN'))
    const [dropped] = lanesOf(laid, 'HG01109.1')
    laid.frames.delete(dropped!)
    expect(undrawnAnchorBp(laid).get('HG01109.1')).toBeGreaterThan(100_000)
    expect(undrawnLaneBp(laid).get('HG01109.1')).toBeGreaterThan(100_000)
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
      expect(Object.values(anchor).filter(bp => bp > 0)).toEqual([])
      expect(Object.values(lane).filter(bp => bp > 0)).toEqual([])
    },
  )
})
