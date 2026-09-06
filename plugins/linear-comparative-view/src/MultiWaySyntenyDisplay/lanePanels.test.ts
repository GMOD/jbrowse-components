import { SimpleFeature } from '@jbrowse/core/util'

import { lanePanelsForRegion } from './lanePanels.ts'
import { groupFeatures } from './layoutMultiWay.ts'

import type { LanePlacementDecision } from './lanePanels.ts'

function record(
  id: string,
  anchor: [number, number],
  mate: { assemblyName: string; refName?: string; start: number; end: number },
  strand = 1,
) {
  return new SimpleFeature({
    uniqueId: id,
    syntenyId: id,
    refName: 'chr1',
    start: anchor[0],
    end: anchor[1],
    strand,
    assemblyName: 'anchor',
    mate: { refName: 'M1', ...mate },
  })
}

const decision = (
  refName: string,
  fit: [number, number],
  flipped = false,
): LanePlacementDecision => ({
  refName,
  fitMin: fit[0],
  fitMax: fit[1],
  flipped,
})

const groups = groupFeatures([
  record('m-a', [1000, 3000], {
    assemblyName: 'mouse',
    start: 5000,
    end: 7000,
  }),
  record('m-b', [4000, 6000], {
    assemblyName: 'mouse',
    start: 8000,
    end: 10_000,
  }),
  // a hit on another contig the lane's decision did not choose
  record('m-x', [2000, 2500], {
    assemblyName: 'mouse',
    refName: 'M9',
    start: 100,
    end: 600,
  }),
  record(
    'd-a',
    [1000, 5000],
    { assemblyName: 'dog', start: 20_000, end: 24_000 },
    -1,
  ),
  record('c-a', [1000, 2000], { assemblyName: 'cow', start: 300, end: 1300 }),
])

const trackAssemblyNames = ['anchor', 'mouse', 'dog']

test('one panel per lane in the stack order, framed on what the lane places of the region on its contig', () => {
  const { mates, unconfigured } = lanePanelsForRegion({
    groups,
    rowAssemblies: ['dog', 'mouse', 'cow'],
    laneDecisions: new Map([
      ['dog', decision('M1', [20_000, 24_000], true)],
      ['mouse', decision('M1', [5000, 10_000])],
      ['cow', decision('M1', [300, 1300])],
    ]),
    region: { refName: 'chr1', start: 0, end: 10_000 },
    trackAssemblyNames,
  })
  expect(mates).toEqual([
    {
      assemblyName: 'dog',
      refName: 'M1',
      anchorStart: 1000,
      anchorEnd: 5000,
      mateStart: 20_000,
      mateEnd: 24_000,
      reversed: true,
    },
    {
      assemblyName: 'mouse',
      refName: 'M1',
      anchorStart: 1000,
      anchorEnd: 6000,
      mateStart: 5000,
      mateEnd: 10_000,
      reversed: false,
    },
  ])
  expect(unconfigured).toEqual(['cow'])
})

// the region cuts through a placement: the mate side is taken in proportion,
// the way the ribbon is drawn, and from the far end of a reversed record
test('a region inside a placement takes the matching slice of the mate, from the far end when reversed', () => {
  const { mates } = lanePanelsForRegion({
    groups,
    rowAssemblies: ['mouse', 'dog'],
    laneDecisions: new Map([
      ['mouse', decision('M1', [5000, 10_000])],
      ['dog', decision('M1', [20_000, 24_000], true)],
    ]),
    region: { refName: 'chr1', start: 2000, end: 4500 },
    trackAssemblyNames,
  })
  expect(
    mates.map(m => [
      m.assemblyName,
      m.anchorStart,
      m.anchorEnd,
      m.mateStart,
      m.mateEnd,
    ]),
  ).toEqual([
    ['mouse', 2000, 4500, 6000, 8500],
    ['dog', 2000, 4500, 20_500, 23_000],
  ])
})

test('a lane the settle has not framed, or that places nothing of the region, has no panel', () => {
  const { mates, unconfigured } = lanePanelsForRegion({
    groups,
    rowAssemblies: ['mouse', 'dog'],
    laneDecisions: new Map([['mouse', decision('M1', [5000, 10_000])]]),
    region: { refName: 'chr1', start: 7000, end: 9000 },
    trackAssemblyNames,
  })
  expect(mates).toEqual([])
  expect(unconfigured).toEqual([])
})
