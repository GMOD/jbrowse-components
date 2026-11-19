import { sequenceRegions } from './assembly.ts'
import { tablesPluginManager } from './index.ts'

test('a circular GenBank record lists as a plain region', async () => {
  const regions = await sequenceRegions(tablesPluginManager(), {
    type: 'GenbankSequenceAdapter',
    genbankLocation: {
      localPath:
        require.resolve('../../../plugins/gff3/src/test_data/two_records.gbk'),
      locationType: 'LocalPathLocation',
    },
  })
  expect(regions).toEqual([
    { refName: 'contig_1', start: 0, end: 120 },
    { refName: 'pTEST.1', start: 0, end: 60 },
  ])
})
