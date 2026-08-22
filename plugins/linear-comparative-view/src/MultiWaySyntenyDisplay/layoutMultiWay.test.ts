import { SimpleFeature } from '@jbrowse/core/util'

import {
  computeRowFrame,
  groupFeatures,
  groupSpanOnRow,
  rowAssembliesOf,
  rowFrameX,
} from './layoutMultiWay.ts'

function pairFeature({
  uniqueId,
  name,
  start,
  end,
  strand = 1,
  mate,
}: {
  uniqueId: string
  name: string
  start: number
  end: number
  strand?: number
  mate: {
    assemblyName: string
    refName: string
    start: number
    end: number
    strand?: number
    name: string
  }
}) {
  return new SimpleFeature({
    uniqueId,
    refName: 'chr1',
    start,
    end,
    strand,
    name,
    assemblyName: 'anchor',
    mate: { strand: 1, ...mate },
  })
}

const features = [
  pairFeature({
    uniqueId: '1',
    name: 'g1',
    start: 100,
    end: 200,
    mate: {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: 1000,
      end: 1100,
      name: 'p1',
    },
  }),
  pairFeature({
    uniqueId: '2',
    name: 'g1',
    start: 100,
    end: 200,
    mate: {
      assemblyName: 'cacao',
      refName: 'Cc1',
      start: 9000,
      end: 9100,
      name: 'c1',
    },
  }),
  pairFeature({
    uniqueId: '3',
    name: 'g2',
    start: 300,
    end: 400,
    mate: {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: 1200,
      end: 1300,
      name: 'p2',
    },
  }),
  pairFeature({
    uniqueId: '4',
    name: 'g3',
    start: 500,
    end: 600,
    mate: {
      assemblyName: 'cacao',
      refName: 'Cc1',
      start: 8000,
      end: 8100,
      name: 'c3',
    },
  }),
  // repeated mate placement, as a reference-anchored table produces
  pairFeature({
    uniqueId: '5',
    name: 'g1',
    start: 100,
    end: 200,
    mate: {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: 1000,
      end: 1100,
      name: 'p1',
    },
  }),
]

test('groups by anchor gene, dedupes repeated mates, sorts by anchor position', () => {
  const groups = groupFeatures(features)
  expect(groups.map(g => g.name)).toEqual(['g1', 'g2', 'g3'])
  expect(groups[0]!.mates.get('peach')).toHaveLength(1)
  expect(groups[0]!.mates.get('cacao')).toHaveLength(1)
  expect(groups[1]!.mates.has('cacao')).toBe(false)
})

test('row assemblies come out in first-appearance order', () => {
  expect(rowAssembliesOf(groupFeatures(features), [])).toEqual([
    'peach',
    'cacao',
  ])
  expect(rowAssembliesOf(groupFeatures(features), ['cacao'])).toEqual([
    'cacao',
    'peach',
  ])
})

test('a forward row frame spans its placements unflipped', () => {
  const groups = groupFeatures(features)
  const frame = computeRowFrame(groups, 'peach')!
  expect(frame.refName).toBe('Pp1')
  expect(frame.flipped).toBe(false)
  expect(frame.min).toBeLessThanOrEqual(1000)
  expect(frame.max).toBeGreaterThanOrEqual(1300)
})

test('a row whose placements run against the anchor order flips', () => {
  const frame = computeRowFrame(groupFeatures(features), 'cacao')!
  expect(frame.flipped).toBe(true)
  const width = 800
  const g1x = rowFrameX(frame, 9050, width)
  const g3x = rowFrameX(frame, 8050, width)
  expect(g1x).toBeLessThan(g3x)
})

test('features carrying syntenyId group on it even with no names', () => {
  const groups = groupFeatures([
    new SimpleFeature({
      uniqueId: '0-1-0-7',
      refName: 'chr1',
      start: 100,
      end: 200,
      syntenyId: 7,
      assemblyName: 'anchor',
      mate: { assemblyName: 'peach', refName: 'Pp1', start: 1000, end: 1100 },
    }),
    new SimpleFeature({
      uniqueId: '0-2-0-7',
      refName: 'chr1',
      start: 100,
      end: 200,
      syntenyId: 7,
      assemblyName: 'anchor',
      mate: { assemblyName: 'cacao', refName: 'Cc1', start: 9000, end: 9100 },
    }),
  ])
  expect(groups).toHaveLength(1)
  expect([...groups[0]!.mates.keys()]).toEqual(['peach', 'cacao'])
})

test('a group with nothing on the dominant refName gets no span on that row', () => {
  const groups = groupFeatures([
    ...features,
    pairFeature({
      uniqueId: '6',
      name: 'g4',
      start: 700,
      end: 800,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp2',
        start: 50,
        end: 60,
        name: 'px',
      },
    }),
  ])
  const frame = computeRowFrame(groups, 'peach')!
  expect(frame.refName).toBe('Pp1')
  const g4 = groups.find(g => g.name === 'g4')!
  expect(groupSpanOnRow(g4, 'peach', frame, 800)).toBeUndefined()
  const g1 = groups.find(g => g.name === 'g1')!
  const span = groupSpanOnRow(g1, 'peach', frame, 800)!
  expect(span[0]).toBeLessThan(span[1])
})
