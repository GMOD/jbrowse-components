import { distinctJunctions, eventStops } from './eventStops.ts'

import type { Junction } from './walkBreakendChain.ts'

const refNameOrder = ['chr1', 'chr3', 'chr11', 'chr13']

function bnd(
  id: string,
  mateId: string | undefined,
  refName: string,
  pos: number,
  mateRefName: string,
  matePos: number,
): Junction {
  return { id, mateId, refName, pos, mateRefName, matePos }
}

// HG008-T V0.5 draft benchmark, EVENT=cluster_3 (CHROMOPLEXY)
const cluster3 = [
  bnd('SV_20', 'SV_190', 'chr3', 139_976_413, 'chr13', 114_353_243),
  bnd('SV_21', 'SV_174', 'chr3', 139_998_693, 'chr3', 193_903_983),
  bnd('SV_174', 'SV_21', 'chr3', 193_903_983, 'chr3', 139_998_693),
  bnd('SV_190', 'SV_20', 'chr13', 114_353_243, 'chr3', 139_976_413),
]

test('a mate pair is one junction', () => {
  expect(distinctJunctions(cluster3).map(j => j.id)).toEqual([
    'SV_190',
    'SV_174',
  ])
})

test('records with no MATEID pair up by their two ends', () => {
  const pair = [
    bnd('a', undefined, 'chr1', 100, 'chr3', 900),
    bnd('b', undefined, 'chr3', 900, 'chr1', 100),
    bnd('c', undefined, 'chr1', 100, 'chr3', 5000),
  ]
  expect(distinctJunctions(pair)).toHaveLength(2)
})

test('an event opens one panel per locus, in genome order', () => {
  expect(eventStops(cluster3, 5000, refNameOrder)).toEqual([
    { refName: 'chr3', pos: 139_976_413 },
    { refName: 'chr3', pos: 139_998_693 },
    { refName: 'chr3', pos: 193_903_983 },
    { refName: 'chr13', pos: 114_353_243 },
  ])
})

test('ends inside one window share a panel centred between them', () => {
  expect(eventStops(cluster3, 25_000, refNameOrder)).toEqual([
    { refName: 'chr3', pos: 139_987_553 },
    { refName: 'chr3', pos: 193_903_983 },
    { refName: 'chr13', pos: 114_353_243 },
  ])
})

test('a contig the assembly does not list sorts after the ones it does', () => {
  const stops = eventStops(
    [bnd('a', undefined, 'chrUn_x', 10, 'chr1', 20)],
    0,
    refNameOrder,
  )
  expect(stops.map(s => s.refName)).toEqual(['chr1', 'chrUn_x'])
})
