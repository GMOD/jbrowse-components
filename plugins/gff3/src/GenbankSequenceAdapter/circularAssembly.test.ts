import { createTestSession } from '@jbrowse/web/testUtils'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

test('a GenBank record whose LOCUS says circular is a circular refName', async () => {
  const session = createTestSession() as any
  session.addAssemblyConf({
    name: 'twoRecords',
    sequence: {
      trackId: 'twoRecords-ReferenceSequenceTrack',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'GenbankSequenceAdapter',
        genbankLocation: {
          localPath: require.resolve('../test_data/two_records.gbk'),
          locationType: 'LocalPathLocation',
        },
      },
    },
  })
  const assembly = await session.assemblyManager.waitForAssembly('twoRecords')
  expect(assembly.isCircularRefName('pTEST.1')).toBe(true)
  expect(assembly.isCircularRefName('contig_1')).toBe(false)
  expect(assembly.regions).toEqual([
    { refName: 'contig_1', start: 0, end: 120, assemblyName: 'twoRecords' },
    { refName: 'pTEST.1', start: 0, end: 60, assemblyName: 'twoRecords' },
  ])
})
