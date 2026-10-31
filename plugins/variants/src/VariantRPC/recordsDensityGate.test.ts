import PluginManager from '@jbrowse/core/PluginManager'
import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'

import VariantsPlugin from '../index.ts'
import { variantCellData } from './executeVariantCellData.ts'

import type { GetCellDataArgs } from './types.ts'

// volvox.filtered.vcf.gz holds 45 records on ctgA, 277..49,288.
function cellData(args: Partial<GetCellDataArgs>) {
  const pluginManager = new PluginManager([new VariantsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return variantCellData({
    pluginManager,
    args: {
      sessionId: 'recordsDensityGate',
      adapterConfig: {
        type: 'VcfTabixAdapter',
        vcfGzLocation: {
          localPath:
            require.resolve('../VcfTabixAdapter/test_data/volvox.filtered.vcf.gz'),
          locationType: 'LocalPathLocation',
        },
        index: {
          location: {
            localPath:
              require.resolve('../VcfTabixAdapter/test_data/volvox.filtered.vcf.gz.tbi'),
            locationType: 'LocalPathLocation',
          },
        },
      },
      regions: [
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 25_000 },
        { assemblyName: 'volvox', refName: 'ctgA', start: 25_000, end: 50_000 },
      ],
      displayedRegionIndices: [3, 4],
      sampleFilter: [],
      siteFilter: [],
      unit: 'sample',
      layout: 'genomic',
      bpPerPx: 1000,
      ...args,
    },
  })
}

function payloadCounts(result: Awaited<ReturnType<typeof cellData>>) {
  return isRegionRefused(result) ? 'refused' : result.value.recordCounts
}

test('the payload counts each region’s records, in regions order', async () => {
  expect(payloadCounts(await cellData({}))).toEqual([24, 21])
})

// 25 kb at 1000 bp/px is 25 px, so 24 records is 0.96 per pixel
test('past the budget the fetch is refused with every region’s count', async () => {
  expect(await cellData({ maxFeatureDensity: 0.9 })).toEqual({
    regionTooLarge: true,
    featureCount: 24,
    bytes: undefined,
    recordCounts: [24, 21],
  })
})

test('at or under the budget the payload is drawn', async () => {
  expect(payloadCounts(await cellData({ maxFeatureDensity: 1 }))).toEqual([
    24, 21,
  ])
})

test('columns count nothing and refuse nothing', async () => {
  expect(
    payloadCounts(
      await cellData({ layout: 'columns', maxFeatureDensity: 0.01 }),
    ),
  ).toEqual([])
})
