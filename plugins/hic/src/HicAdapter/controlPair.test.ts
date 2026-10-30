import HicAdapter from './HicAdapter.ts'
import configSchema from './configSchema.ts'

import type { Region } from '@jbrowse/core/util/types'

// A map and its control as two small fake files, so each rule of the joined
// fetch can be broken on its own: which axis a mask applies to, under which
// chromosome name, the raw re-read, the depth, a pair one file lacks.

interface FakeFile {
  /** name -> length; names may differ from the other file's */
  chromosomes: Record<string, number>
  /** `${chr1}-${chr2}` -> [bin1, bin2, count] cells */
  cells: Record<string, [number, number, number][]>
  /** chr -> normalization factor per bin, for KR; absent is no KR vector */
  kr?: Record<string, number[]>
  total?: number
}

const RES = 10

function fakeHic(file: FakeFile) {
  const chromosomes = Object.entries(file.chromosomes).map(
    ([name, size], index) => ({ name, size, index }),
  )
  const nameOf = (index: number) => chromosomes[index]!.name
  const applied = (norm: string, a: string, b: string) =>
    norm === 'KR' && file.kr?.[a] && file.kr[b] ? 'KR' : 'NONE'
  return {
    getMetaData: () => Promise.resolve({ chromosomes, resolutions: [RES] }),
    getNormalizationOptions: () => Promise.resolve(['NONE', 'KR']),
    getTotalContacts: () => Promise.resolve(file.total),
    getMatrix: (i: number, j: number) => {
      const cells = file.cells[`${nameOf(i)}-${nameOf(j)}`]
      return Promise.resolve(
        cells
          ? {
              getZoomData: () => ({
                sumCounts: cells.reduce((s, c) => s + c[2], 0),
              }),
            }
          : undefined,
      )
    },
    getContactRecords: (
      norm: string,
      r1: { chr: string },
      r2: { chr: string },
    ) => {
      const cells = file.cells[`${r1.chr}-${r2.chr}`] ?? []
      return Promise.resolve({
        records: {
          bin1: Int32Array.from(cells, c => c[0]),
          bin2: Int32Array.from(cells, c => c[1]),
          counts: Float32Array.from(cells, c => c[2]),
        },
        appliedNormalization: applied(norm, r1.chr, r2.chr),
        transposed: false,
      })
    },
    getNormalizationVector: (type: string, chr: string) => {
      const factors = type === 'KR' ? file.kr?.[chr] : undefined
      return Promise.resolve(
        factors && {
          getValues: (start: number, end: number) =>
            Float64Array.from(factors.slice(start, end)),
        },
      )
    },
    getExpectedValues: () => Promise.resolve(undefined),
  }
}

function adapterOver(file: FakeFile) {
  const adapter = new HicAdapter(
    configSchema.create({
      hicLocation: { uri: 'x.hic', locationType: 'UriLocation' },
    }),
  )
  ;(adapter as unknown as { hic: unknown }).hic = fakeHic(file)
  return adapter
}

function compare(map: FakeFile, control: FakeFile) {
  const controlAdapter = adapterOver(control)
  const adapter = new HicAdapter(
    configSchema.create({
      hicLocation: { uri: 'map.hic', locationType: 'UriLocation' },
      controlAdapter: { type: 'HicAdapter', uri: 'control.hic' },
    }),
    () =>
      Promise.resolve({
        dataAdapter: controlAdapter,
        sessionIds: new Set<string>(),
      }),
  )
  ;(adapter as unknown as { hic: unknown }).hic = fakeHic(map)
  return adapter
}

const REGIONS: Region[] = [
  { assemblyName: 'a', refName: '1', start: 0, end: 100 },
  { assemblyName: 'a', refName: '2', start: 0, end: 100 },
]

function fetch(adapter: HicAdapter, normalization = 'KR') {
  return adapter.getMultiRegionContactRecords(REGIONS, {
    resolution: RES,
    normalization,
    control: true,
  })
}

function cellsOf(pair: {
  bin1: Int32Array
  bin2: Int32Array
  counts: Float32Array
  control?: { counts: Float32Array }
}) {
  return Array.from(pair.bin1, (b1, i) => [
    b1,
    pair.bin2[i],
    pair.counts[i],
    pair.control?.counts[i],
  ])
}

const ALL_VALID = Array.from({ length: 10 }, () => 1)
const masked = (bin: number) => ALL_VALID.map((v, i) => (i === bin ? 0 : v))

test('a mask drops a one-sided cell on the axis and chromosome it names', async () => {
  const map: FakeFile = {
    chromosomes: { '1': 100, '2': 100 },
    // a cell only the map lists, at chr2 bin 5, and one at chr2 bin 6
    cells: {
      '1-2': [
        [0, 5, 4],
        [0, 6, 4],
      ],
      '1-1': [],
      '2-2': [],
    },
    kr: { '1': ALL_VALID, '2': ALL_VALID },
  }
  const control: FakeFile = {
    chromosomes: { chr1: 100, chr2: 100 },
    cells: { 'chr1-chr2': [[3, 6, 2]], 'chr1-chr1': [], 'chr2-chr2': [] },
    // the control masks chr2 bin 5, its y axis in this pair
    kr: { chr1: ALL_VALID, chr2: masked(5) },
  }
  const { pairs } = await fetch(compare(map, control))
  const inter = pairs.find(p => p.region1Idx === 0 && p.region2Idx === 1)!
  expect(cellsOf(inter).sort()).toEqual([
    [0, 6, 4, 0],
    [3, 6, 0, 2],
  ])
})

test('two files fallen back to different normalizations both read raw', async () => {
  const map: FakeFile = {
    chromosomes: { '1': 100, '2': 100 },
    cells: { '1-1': [[1, 2, 5]], '1-2': [], '2-2': [] },
    kr: { '1': ALL_VALID, '2': ALL_VALID },
  }
  const control: FakeFile = {
    chromosomes: { '1': 100, '2': 100 },
    cells: { '1-1': [[1, 2, 7]], '1-2': [], '2-2': [] },
  }
  const { pairs } = await fetch(compare(map, control))
  expect(pairs[0]!.appliedNormalization).toBe('NONE')
})

test('library totals scale the depth only where both files have one', async () => {
  const files = (mapTotal?: number, controlTotal?: number) =>
    compare(
      {
        chromosomes: { '1': 100, '2': 100 },
        cells: { '1-1': [[1, 2, 6]], '1-2': [], '2-2': [] },
        total: mapTotal,
      },
      {
        chromosomes: { '1': 100, '2': 100 },
        cells: { '1-1': [[1, 2, 3]], '1-2': [], '2-2': [] },
        total: controlTotal,
      },
    )
  const depthOf = async (adapter: HicAdapter) => {
    const { control } = (await fetch(adapter, 'NONE')).pairs[0]!
    return [control!.depth, control!.controlDepth]
  }
  expect(await depthOf(files(1000, 4000))).toEqual([1000, 4000])
  // one file's total over the other's pair sum would scale by orders of
  // magnitude; both fall back to their pair sums
  expect(await depthOf(files(1000, undefined))).toEqual([6, 3])
  // hictk writes the `ALL` map's total as 1, below the pair it holds
  expect(await depthOf(files(1, 1))).toEqual([6, 3])
})

// A count is the raw one over `v[i] * v[j]`, so a vector balancing rows to 1
// leaves counts far below 1 until its means turn them back into contacts
test("a count stands for its two vectors' means in contacts", async () => {
  const chromosomes = { '1': 100, '2': 100 }
  const cells = {
    '1-1': [[1, 2, 6]],
    '1-2': [],
    '2-2': [],
  } as FakeFile['cells']
  const adapter = compare(
    { chromosomes, cells, kr: { '1': ALL_VALID.map(() => 4), '2': ALL_VALID } },
    {
      chromosomes,
      cells,
      kr: { '1': masked(3).map(v => v * 2), '2': ALL_VALID },
    },
  )
  const perCount = async (normalization: string) => {
    const { control } = (await fetch(adapter, normalization)).pairs[0]!
    return [control!.contactsPerCount, control!.controlContactsPerCount]
  }
  // the control's masked bin is no factor and leaves the mean
  expect(await perCount('KR')).toEqual([16, 4])
  expect(await perCount('NONE')).toEqual([1, 1])
})

// the parser answers a missing matrix with no records, which a join would
// read as a control of zeros and paint solid
test('a pair the control holds no matrix for comes back without a control', async () => {
  const map: FakeFile = {
    chromosomes: { '1': 100, '2': 100 },
    cells: { '1-1': [[1, 2, 5]], '1-2': [[0, 5, 4]], '2-2': [] },
  }
  const control: FakeFile = {
    chromosomes: { '1': 100, '2': 100 },
    cells: { '1-1': [[1, 2, 7]], '2-2': [] },
  }
  const { pairs } = await fetch(compare(map, control), 'NONE')
  const inter = pairs.find(p => p.region1Idx === 0 && p.region2Idx === 1)!
  expect(inter.control).toBeUndefined()
  expect(pairs.find(p => p.region2Idx === 0)!.control).toBeDefined()
})
