import { parseCigar2 } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

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

test('a lane gap the anchor spans alike carries nothing the anchor lacks', () => {
  const piece = (id: string, start: number, end: number) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'chr1',
      start,
      end,
      strand: 1,
      mate: { assemblyName: 'apart', refName: 'c', start, end },
    })
  const apart = laneProfiles(
    [piece('l', 0, 10_000), piece('r', 40_000, 50_000)],
    new Map(),
  ).get('apart')!
  expect(Math.max(...apart.slice((2 * apart.length) / 3))).toBe(0)
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
