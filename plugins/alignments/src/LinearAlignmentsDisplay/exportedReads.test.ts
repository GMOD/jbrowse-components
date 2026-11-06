import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { exportFetches, exportedReadsOf } from './exportedReads.ts'

import type { Region } from '@jbrowse/core/util'

const region = (refName: string, start: number, end: number): Region => ({
  assemblyName: 'volvox',
  refName,
  start,
  end,
})

const sameAssembly = (a: string, b: string) => a === b

function read(name: string, start = 100, end = 200) {
  return new SimpleFeature({
    uniqueId: name,
    refName: 'ctgA',
    start,
    end,
    name,
  })
}

const names = ({ features }: { features: { get: (f: string) => unknown }[] }) =>
  features.map(f => f.get('name'))

test('an export region inside a rendered span is read over that span', () => {
  const loaded = { ...region('ctgA', 900.5, 5000.25), fetchInputs: {} }
  expect(
    exportFetches(
      [region('ctgA', 1000, 2000), region('ctgA', 3000, 4000)],
      [loaded],
      sameAssembly,
    ),
  ).toEqual([
    {
      region: region('ctgA', 900.5, 5000.25),
      windows: [region('ctgA', 1000, 2000), region('ctgA', 3000, 4000)],
    },
  ])
})

test('an export region no rendered span holds is read as itself', () => {
  expect(
    exportFetches(
      [region('ctgA', 1000, 6000), region('ctgB', 0, 100)],
      [region('ctgA', 900, 5000), region('ctgA', 0, 200)],
      sameAssembly,
    ),
  ).toEqual([
    {
      region: region('ctgA', 1000, 6000),
      windows: [region('ctgA', 1000, 6000)],
    },
    { region: region('ctgB', 0, 100), windows: [region('ctgB', 0, 100)] },
  ])
})

const window = [region('ctgA', 150, 300)]
const fetched = [
  {
    windows: window,
    reads: [
      { feature: read('drawn'), lane: '+', drawn: true },
      { feature: read('counted'), lane: '+', drawn: false },
      { feature: read('hiddenLane'), lane: '-', drawn: true },
      { feature: read('hiddenLaneCounted'), lane: '-', drawn: false },
      { feature: read('margin', 400, 500), lane: '+', drawn: true },
    ],
  },
]

test('a read format writes the drawn reads of the visible lanes', () => {
  const result = exportedReadsOf(fetched, 'drawn', new Set(['-']))
  expect(names(result)).toEqual(['drawn'])
  expect(result.filteredOut).toBe(3)
})

test('a depth counts every read of the visible lanes, drawn or not', () => {
  const result = exportedReadsOf(fetched, 'counted', new Set(['-']))
  expect(names(result)).toEqual(['drawn', 'counted'])
  expect(result.filteredOut).toBe(2)
})

test('a read two spans return is written once, if either keeps it', () => {
  const twice = [
    {
      windows: window,
      reads: [{ feature: read('a'), lane: '', drawn: false }],
    },
    {
      windows: window,
      reads: [{ feature: read('a'), lane: '', drawn: true }],
    },
  ]
  const result = exportedReadsOf(twice, 'drawn', new Set())
  expect(names(result)).toEqual(['a'])
  expect(result.filteredOut).toBe(0)
})
