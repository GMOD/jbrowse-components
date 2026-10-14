import { asTable } from './featureTable.ts'
import { encodeFeatures } from './markEncoding.ts'
import { pathSeries } from './pathSeries.ts'
import SimpleFeature from './simpleFeature.ts'

import type { FeatureTable } from './featureTable.ts'

function feature(start: number, rest: Record<string, unknown> = {}) {
  return new SimpleFeature({
    uniqueId: `${rest.code ?? ''}${start}`,
    refName: 'ctgA',
    start,
    end: start + 1,
    ...rest,
  })
}

function read(table: FeatureTable, ...fields: string[]) {
  return Array.from({ length: table.length }, (_, i) => {
    const f = table.row(i)
    return fields.map(field => f.get(field))
  })
}

// Two modification codes at each site, as a modkit bedMethyl lists them.
const interleaved = [0, 10, 20].flatMap(start => [
  feature(start, { code: 'h', score: 1 }),
  feature(start, { code: 'm', score: 2 }),
])

test('rows sharing their starts come out a series per value of by, each in start order', () => {
  const { table, series } = pathSeries(
    asTable(interleaved),
    undefined,
    { by: 'code' },
    [],
  )
  expect(read(table, 'code', 'start')).toEqual([
    ['h', 0],
    ['h', 10],
    ['h', 20],
    ['m', 0],
    ['m', 10],
    ['m', 20],
  ])
  expect([...series]).toEqual([0, 0, 0, 1, 1, 1])
})

test('a stacked row array follows its rows, and each row is its own series', () => {
  const { table, row, series } = pathSeries(
    asTable([feature(20), feature(0), feature(10), feature(5)]),
    Uint32Array.of(1, 1, 0, 0),
    {},
    [],
  )
  expect(read(table, 'start')).toEqual([[0], [20], [5], [10]])
  expect([...(row as Uint32Array)]).toEqual([1, 1, 0, 0])
  expect([...series]).toEqual([0, 0, 1, 1])
})

test('a window in front sets the gap to the bases its frame spans at the median row', () => {
  const starts = [0, 10, 20, 30, 40, 1000, 1010]
  const steps = [
    {
      type: 'window' as const,
      frame: [-1, 1] as [number, number],
      ops: [{ op: 'mean' as const, field: 'score' }],
    },
  ]
  const { gapBp } = pathSeries(
    asTable(starts.map(s => feature(s))),
    undefined,
    {},
    steps,
  )
  // spans 10, 20, 20, 20, 970, 970, 10: the median is 20
  expect(gapBp).toBe(20)
  expect(
    pathSeries(asTable(starts.map(s => feature(s))), undefined, {}, [
      { ...steps[0]!, frame: [null, 0] },
    ]).gapBp,
  ).toBeUndefined()
  expect(
    pathSeries(
      asTable(starts.map(s => feature(s))),
      undefined,
      { gapBp: 500 },
      steps,
    ).gapBp,
  ).toBe(500)
  expect(
    pathSeries(asTable(starts.map(s => feature(s))), undefined, {}, []).gapBp,
  ).toBeUndefined()
})

test('the encoder fills the series lane from the series beside the rows', () => {
  const { table, series } = pathSeries(
    asTable(interleaved),
    undefined,
    { by: 'code' },
    [],
  )
  const encoded = encodeFeatures(table, { y: 'score', series }, ['y', 'series'])
  expect([...encoded.series]).toEqual([0, 0, 0, 1, 1, 1])
  expect([...encoded.y]).toEqual([1, 1, 1, 2, 2, 2])
})
