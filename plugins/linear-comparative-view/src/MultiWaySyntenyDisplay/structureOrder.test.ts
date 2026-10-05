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

test('a profile reads a deletion as uncovered bins and an insertion as carried sequence', () => {
  const profiles = stack([
    ['del', 'deletion'],
    ['ins', 'insertion'],
  ])
  const del = profiles.get('del')!
  const ins = profiles.get('ins')!
  const bins = del.length / 2
  expect(del[bins / 2]).toBe(0)
  expect(del[0]).toBe(1)
  expect(Math.max(...del.slice(bins))).toBe(0)
  expect(Math.max(...ins.slice(bins))).toBe(20_000 / 100)
})
