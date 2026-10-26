import HicAdapter from './HicAdapter.ts'
import configSchema from './configSchema.ts'

const HIC = require.resolve('../../../../extra_test_data/test.hic')

// test.hic has no SCALE vector for chrY at any binsize, so a view across
// chr22 and chrY gets SCALE on chr22's own pair and raw counts on the two
// pairs chrY is in: the matrix reports both, the requested one first
test('a view across a chromosome lacking the normalization reports both', async () => {
  const adapter = new HicAdapter(
    configSchema.create({
      hicLocation: { localPath: HIC, locationType: 'LocalPathLocation' },
    }),
  )
  const { chromosomes } = await adapter.getMetadata()
  const regions = ['22', 'Y'].map(refName => ({
    assemblyName: 'hg19',
    refName,
    start: 0,
    end: chromosomes.find(c => c.name === refName)!.size,
  }))
  const { pairs, appliedNormalizations } =
    await adapter.getMultiRegionContactRecords(regions, {
      resolution: 2_500_000,
      normalization: 'SCALE',
    })
  expect(pairs.map(p => p.appliedNormalization)).toEqual([
    'SCALE',
    'NONE',
    'NONE',
  ])
  expect(appliedNormalizations).toEqual(['SCALE', 'NONE'])
})
