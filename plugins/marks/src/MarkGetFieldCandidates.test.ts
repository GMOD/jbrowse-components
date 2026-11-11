import PluginManager from '@jbrowse/core/PluginManager'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import MarkGetFieldCandidates from './MarkGetFieldCandidates.ts'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

const blocks = [
  { refName: 'chr16', start: 0, end: 100, assemblyName: 'hg38' },
  { refName: 'chr16', start: 100, end: 200, assemblyName: 'hg38' },
]

// ClinVar's bigBed as it reads: a BED12 row of one block, markup and JSON
// beside the categories, and a variant spanning both blocks answered twice.
function variant(id: string, clinSign: string, start: number) {
  return new SimpleFeature({
    uniqueId: id,
    refName: 'chr16',
    start,
    end: start + 1,
    name: id,
    clinSign,
    reserved: '0,210,0',
    thickStart: start,
    thickEnd: start + 1,
    blockCount: 1,
    blockSizes: [1],
    chromStarts: [0],
    reviewStatus: '&#9733;&#9733;&#9734;&#9734;',
    _mouseOver: `<b>${clinSign}</b>`,
    _jsonHgvsTable: '[["g.4690G>A", "-"]]',
  })
}

function scan(byteLimit: number | undefined, bytes = 0) {
  const asked: unknown[] = []
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getFeaturesArray: (region: { start: number }) => {
      asked.push(region)
      return Promise.resolve(
        region.start === 0
          ? [variant('VCV1', 'Benign', 10), variant('VCV2', 'Pathogenic', 99)]
          : [variant('VCV2', 'Pathogenic', 99)],
      )
    },
    getRegionByteSize: () => Promise.resolve(bytes),
  } as never)
  return {
    asked,
    result: new MarkGetFieldCandidates(new PluginManager()).execute({
      sessionId: 'test',
      adapterConfig: {},
      regions: blocks,
      byteLimit,
    }),
  }
}

test('lists the attributes the features in view carry with their values, counting a feature two blocks answer once, and no geometry or markup', async () => {
  const { asked, result } = scan(undefined)
  expect(await result).toEqual([
    {
      field: 'clinSign',
      values: ['Benign', 'Pathogenic'],
      missing: false,
      overflow: false,
    },
    {
      field: 'name',
      values: ['VCV1', 'VCV2'],
      missing: false,
      overflow: false,
    },
    { field: 'reserved', values: ['0,210,0'], missing: false, overflow: false },
  ])
  expect(asked).toHaveLength(2)
})

test("is refused where the display's byte budget refuses the view", async () => {
  const { asked, result } = scan(1_000, 5_000)
  expect(await result).toEqual({ regionTooLarge: true, bytes: 5_000 })
  expect(asked).toHaveLength(0)
})
