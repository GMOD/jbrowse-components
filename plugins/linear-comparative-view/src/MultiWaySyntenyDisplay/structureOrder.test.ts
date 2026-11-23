import { parseCigar2 } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { changeLabel } from './laneHeader.ts'
import { groupFeatures, laneIndelsOf } from './layoutMultiWay.ts'
import { laneProfiles, structureOrder } from './structureOrder.ts'

// three structures over chr1:0-12,000: the anchor's, a 4 kb deletion, and a
// 20 kb insertion at 6 kb
const shapes = {
  same: '12000=',
  deletion: '4000=4000D4000=',
  insertion: '6000=20000I6000=',
}

function stack(lanes: [string, keyof typeof shapes][]) {
  const features = lanes.map(
    ([lane]) =>
      new SimpleFeature({
        uniqueId: lane,
        refName: 'chr1',
        start: 0,
        end: 12_000,
        strand: 1,
        mate: { assemblyName: lane, refName: 'c', start: 0, end: 32_000 },
      }),
  )
  const ops = new Map(
    lanes.map(([lane, shape]) => [
      lane,
      Uint32Array.from(parseCigar2(shapes[shape])),
    ]),
  )
  return laneProfiles(features, ops)
}

test('lanes of one structure sit together, the anchor-like ones first', () => {
  const order = structureOrder(
    stack([
      ['a', 'insertion'],
      ['b', 'deletion'],
      ['c', 'same'],
      ['d', 'insertion'],
      ['e', 'deletion'],
      ['f', 'same'],
    ]),
  )
  const shapeOf = { a: 'i', b: 'd', c: 's', d: 'i', e: 'd', f: 's' }
  const runs = order
    .map(l => shapeOf[l as keyof typeof shapeOf])
    .join('')
    .replaceAll(/(.)\1+/g, '$1')
  expect(runs).toHaveLength(3)
  expect(runs[0]).toBe('s')
})

test('of two lanes, the anchor-like one sits first', () => {
  expect(
    structureOrder(
      stack([
        ['a', 'deletion'],
        ['b', 'same'],
      ]),
    ),
  ).toEqual(['b', 'a'])
})

test('an insertion that split its record weighs what one inside a record does', () => {
  const piece = (
    id: string,
    start: number,
    end: number,
    mate: [number, number],
  ) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'chr1',
      start,
      end,
      strand: 1,
      mate: {
        assemblyName: 'split',
        refName: 'c',
        start: mate[0],
        end: mate[1],
      },
    })
  const split = laneProfiles(
    [
      piece('l', 0, 6000, [0, 6000]),
      piece('r', 6000, 12_000, [26_000, 32_000]),
    ],
    new Map(),
  ).get('split')!
  const whole = stack([['whole', 'insertion']]).get('whole')!
  expect([...split]).toEqual([...whole])
})

test('a reversed piece inside an insertion leaves it stating nothing, so it weighs nothing', () => {
  const piece = (
    id: string,
    start: number,
    end: number,
    mate: [number, number],
    strand = 1,
  ) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'chr1',
      start,
      end,
      strand,
      mate: {
        assemblyName: 'lane',
        refName: 'c',
        start: mate[0],
        end: mate[1],
      },
    })
  const insertionOf = (features: SimpleFeature[]) => {
    const profile = laneProfiles(features, new Map()).get('lane')!
    return [...profile.slice((2 * profile.length) / 3)]
  }
  const flanks = [
    piece('l', 0, 6000, [0, 6000]),
    piece('r', 6000, 12_000, [26_000, 32_000]),
  ]
  const withCopy = insertionOf([
    ...flanks,
    piece('copy', 0, 2000, [10_000, 12_000], -1),
  ])
  expect(withCopy.every(bin => bin === 0)).toBe(true)
  expect(insertionOf(flanks).some(bin => bin > 0)).toBe(true)
})

const insertedBp = (profile: Float64Array, binBp: number) =>
  profile.slice((2 * profile.length) / 3).reduce((sum, bins) => sum + bins, 0) *
  binBp

test('a lane gap the anchor spans alike carries the lane side its header states, and nothing across two fetch windows', () => {
  const piece = (id: string, start: number, end: number, clipWindow: string) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'chr1',
      start,
      end,
      strand: 1,
      clipWindow,
      mate: { assemblyName: 'apart', refName: 'c', start, end },
    })
  const oneWindow = [
    piece('l', 0, 10_000, '0-50000'),
    piece('r', 40_000, 50_000, '0-50000'),
  ]
  expect(
    laneIndelsOf(groupFeatures(oneWindow))
      .changes('apart', 'c')
      .map(changeLabel),
  ).toEqual(['30 kb replaced by 30 kb'])
  expect(
    insertedBp(laneProfiles(oneWindow, new Map()).get('apart')!, 50_000 / 120),
  ).toBeCloseTo(30_000)
  const twoWindows = [
    piece('l', 0, 10_000, '0-10000'),
    piece('r', 40_000, 50_000, '40000-50000'),
  ]
  expect(
    insertedBp(laneProfiles(twoWindows, new Map()).get('apart')!, 50_000 / 120),
  ).toBe(0)
})

test('a lane with pieces on both strands carries the sequence its header states', () => {
  // HG01960#1 at TBC1D3, whose header says "54 kb replaced by 37 kb"
  const rows: [number, number, number, number, number][] = [
    [38_088_871, 38_126_163, 12_822_791, 12_860_061, 1],
    [38_044_769, 38_070_363, 12_860_095, 12_885_663, -1],
    [37_944_212, 37_990_833, 12_922_903, 12_969_514, -1],
    [38_054_281, 38_141_006, 12_974_424, 13_061_695, 1],
  ]
  const profile = laneProfiles(
    rows.map(
      ([start, end, mateStart, mateEnd, strand], i) =>
        new SimpleFeature({
          uniqueId: `r${i}`,
          refName: 'chr17',
          start,
          end,
          strand,
          mate: {
            assemblyName: 'HG01960.1',
            refName: 'JBHIHM010000033.1',
            start: mateStart,
            end: mateEnd,
          },
        }),
    ),
    new Map(),
  ).get('HG01960.1')!
  expect(insertedBp(profile, (38_141_006 - 37_944_212) / 120)).toBeCloseTo(
    37_240,
  )
})

test('an array record aligns nothing and states no sequence the anchor lacks', () => {
  // HG00126#1 at the chrY palindrome: a reversed array between forward pieces
  const rows: [string, number, number, number, number, number][] = [
    ['match', -1, 18_328_672, 18_339_374, 17_933_687, 17_944_389],
    ['match', 1, 18_328_672, 18_346_436, 18_695_745, 18_713_509],
    ['match', 1, 18_354_591, 18_452_944, 18_721_666, 18_820_022],
    ['array', -1, 18_452_944, 18_847_408, 18_822_920, 19_217_599],
    ['array', 1, 18_452_944, 18_847_408, 19_220_306, 19_233_868],
    ['match', -1, 18_450_877, 18_452_944, 19_234_557, 19_236_624],
  ]
  const profile = laneProfiles(
    rows.map(
      ([type, strand, start, end, mateStart, mateEnd], i) =>
        new SimpleFeature({
          uniqueId: `r${i}`,
          recordId: `record-${i}`,
          refName: 'chrY',
          start,
          end,
          strand,
          ...(type === 'array' ? { type } : {}),
          mate: {
            assemblyName: 'HG00126.1',
            refName: 'JBHIKU010000040.1',
            start: mateStart,
            end: mateEnd,
          },
        }),
    ),
    new Map(),
  ).get('HG00126.1')!
  const bins = profile.length / 3
  expect(Math.max(...profile.slice(2 * bins))).toBe(0)
  expect(
    Math.max(
      ...profile.slice(bins / 2, bins),
      ...profile.slice(bins + bins / 2, 2 * bins),
    ),
  ).toBe(0)
})

test('a profile reads a deletion as uncovered bins and an insertion as carried sequence', () => {
  const profiles = stack([
    ['del', 'deletion'],
    ['ins', 'insertion'],
  ])
  const del = profiles.get('del')!
  const ins = profiles.get('ins')!
  const bins = del.length / 3
  expect(del[bins / 2]).toBe(0)
  expect(del[0]).toBe(1)
  expect(Math.max(...del.slice(bins))).toBe(0)
  expect(Math.max(...ins.slice(2 * bins))).toBe(20_000 / 100)
})

test('an inversion carrier sits at an end, and a lane reversed whole sits with the collinear ones', () => {
  const run = (lane: string, start: number, end: number, strand: number) =>
    new SimpleFeature({
      uniqueId: `${lane}:${start}`,
      refName: 'chr1',
      start,
      end,
      strand,
      mate: { assemblyName: lane, refName: 'c', start, end },
    })
  const collinear = (lane: string) => [run(lane, 0, 12_000, 1)]
  const order = structureOrder(
    laneProfiles(
      [
        ...collinear('a'),
        ...collinear('b'),
        ...collinear('c'),
        run('i', 0, 4000, 1),
        run('i', 4000, 8000, -1),
        run('i', 8000, 12_000, 1),
        run('r', 0, 12_000, -1),
      ],
      new Map(),
    ),
  )
  expect(order.at(-1)).toBe('i')
  expect(order.slice(0, 4).toSorted()).toEqual(['a', 'b', 'c', 'r'])
})
