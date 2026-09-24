import PluginManager from '@jbrowse/core/PluginManager'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { clusterMarkRows } from './clusterMarkRows.ts'
import { collectMarkRowMatrix } from './collectMarkRowMatrix.ts'

import type { MarkRowMatrixArgs } from './rpcTypes.ts'
import type { Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

const pluginManager = new PluginManager()

function region(start: number, end: number, refName = 'ctgA'): Region {
  return { refName, start, end, assemblyName: 'volvox' }
}

function feats(
  records: { source: string; start: number; end: number; score: number }[],
) {
  return records.map(
    (data, i) =>
      new SimpleFeature({ uniqueId: `f${i}`, refName: 'ctgA', ...data }),
  )
}

function stubAdapter(byRegion: SimpleFeature[][]) {
  const getFeaturesArray = jest.fn((_region: Region, _opts: unknown) =>
    Promise.resolve(byRegion.shift() ?? []),
  )
  jest
    .mocked(getFeatureAdapterOrThrow)
    .mockResolvedValue({ getFeaturesArray } as never)
  return getFeaturesArray
}

function args(over: Partial<MarkRowMatrixArgs>) {
  return {
    sessionId: 'test',
    adapterConfig: { type: 'BedAdapter' },
    regions: [region(0, 10)],
    rows: ['a', 'b', 'c'],
    transform: [],
    facet: { field: 'source' },
    bpPerPx: 2.5,
    layer: { encoding: { y: 'score' }, lanes: [] },
    ...over,
  }
}

async function matrix(over: Partial<MarkRowMatrixArgs>) {
  const rows = await collectMarkRowMatrix({ pluginManager, args: args(over) })
  return Object.fromEntries([...rows].map(([name, row]) => [name, [...row]]))
}

test('each row averages the instances split into it, over the columns each covers', async () => {
  const getFeaturesArray = stubAdapter([
    feats([
      { source: 'a', start: 0, end: 10, score: 2 },
      { source: 'a', start: 0, end: 5, score: 4 },
      { source: 'b', start: 4, end: 6, score: 1 },
      { source: 'nobody', start: 0, end: 10, score: 9 },
    ]),
  ])
  expect(await matrix({})).toEqual({
    a: [3, 3, 2, 2],
    b: [0, 1, 0, 0],
    c: [0, 0, 0, 0],
  })
  expect(getFeaturesArray).toHaveBeenCalledWith(
    region(0, 10),
    expect.objectContaining({ bpPerPx: 2.5 }),
  )
})

test('the rows keep the order asked, and each region takes its own columns', async () => {
  stubAdapter([
    feats([{ source: 'z', start: 0, end: 5, score: 1 }]),
    feats([{ source: 'a', start: 105, end: 110, score: 5 }]),
  ])
  const rows = await collectMarkRowMatrix({
    pluginManager,
    args: args({
      rows: ['z', 'a'],
      regions: [region(0, 10), region(100, 110, 'ctgB')],
      bpPerPx: 5,
    }),
  })
  expect([...rows.keys()]).toEqual(['z', 'a'])
  expect([...rows.get('z')!]).toEqual([1, 0, 0, 0])
  expect([...rows.get('a')!]).toEqual([0, 0, 0, 5])
})

test("the layer's own steps run over each row's features alone", async () => {
  stubAdapter([
    feats([
      { source: 'a', start: 0, end: 1, score: 1 },
      { source: 'a', start: 1, end: 2, score: 1 },
      { source: 'b', start: 0, end: 1, score: 1 },
    ]),
  ])
  expect(
    await matrix({
      rows: ['a', 'b'],
      bpPerPx: 10,
      layer: {
        encoding: { y: 'count' },
        lanes: [],
        transform: [{ type: 'aggregate', ops: [{ op: 'count', as: 'count' }] }],
      },
    }),
  ).toEqual({ a: [2], b: [1] })
})

// A bedMethyl's CpGs are 1 bp, far narrower than a column at any window worth
// clustering, so a row that kept only instances covering a column's midpoint
// was all zeros.
test('1 bp calls cluster on their values in a window of wide columns', async () => {
  const calls = (source: string, level: (pos: number) => number) =>
    Array.from({ length: 200 }, (_, i) => {
      const start = i * 500 + 17
      return { source, start, end: start + 1, score: level(start) }
    })
  const early = (pos: number) => (pos < 50_000 ? 90 : 10)
  const late = (pos: number) => (pos < 50_000 ? 10 : 90)
  const window = {
    regions: [region(0, 100_000)],
    rows: ['early1', 'late1', 'early2', 'late2'],
    bpPerPx: 100,
  }
  stubAdapter([
    feats([
      ...calls('early1', early),
      ...calls('late1', late),
      ...calls('early2', pos => early(pos) - 5),
      ...calls('late2', pos => late(pos) + 5),
    ]),
  ])
  const rows = await matrix(window)
  expect(rows.early1!.filter(v => v !== 0)).toHaveLength(200)
  expect(rows.early1![0]).toBe(90)
  expect(rows.late2!.at(-5)).toBe(95)

  stubAdapter([
    feats([
      ...calls('early1', early),
      ...calls('late1', late),
      ...calls('early2', pos => early(pos) - 5),
      ...calls('late2', pos => late(pos) + 5),
    ]),
  ])
  const { order } = await clusterMarkRows({ pluginManager, args: args(window) })
  const leaves = order.map(i => window.rows[i])
  expect(Math.abs(leaves.indexOf('early1') - leaves.indexOf('early2'))).toBe(1)
  expect(Math.abs(leaves.indexOf('late1') - leaves.indexOf('late2'))).toBe(1)
})
