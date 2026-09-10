import { mirrorRegionsForCircle } from './mirrorRegions.ts'

import type { Region } from '@jbrowse/core/util'

function region(refName: string, reversed?: boolean): Region {
  return { assemblyName: 'mm39', refName, start: 0, end: 100, reversed }
}

test('the arc runs the other way: reverse order, each region flipped', () => {
  expect(
    mirrorRegionsForCircle([region('chr1'), region('chr2'), region('chr3')]),
  ).toEqual([region('chr3', true), region('chr2', true), region('chr1', true)])
})

// The reorder mirrors the circle's regions back into the linear order the shared
// algorithm answers for, asks it, and mirrors the answer forward again — so a
// pass over a circle that is already diagonalized has to report that nothing
// moved, rather than flipping the whole genome on every run.
// `reversed` spelled out on every region: the mirror answers a boolean where a
// region off a session may carry none, so the round trip is the identity over
// what it itself produces.
test('mirroring twice is the identity', () => {
  const regions = [
    region('chr1', true),
    region('chr2', false),
    region('chr3', true),
  ]
  expect(mirrorRegionsForCircle(mirrorRegionsForCircle(regions))).toEqual(
    regions,
  )
})

test('the input is left alone', () => {
  const regions = [region('chr1'), region('chr2')]
  mirrorRegionsForCircle(regions)
  expect(regions.map(r => r.refName)).toEqual(['chr1', 'chr2'])
})
