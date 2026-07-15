import Adapter from './NcbiSequenceReportAliasAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter(useNameOverride?: boolean) {
  return new Adapter(
    configSchema.create({
      location: {
        localPath: require.resolve('./test_data/sequence_report.tsv'),
        locationType: 'LocalPathLocation',
      },
      ...(useNameOverride === undefined ? {} : { useNameOverride }),
    }),
  )
}

test('parses an NCBI sequence_report.tsv', async () => {
  const result = await makeAdapter().getRefNameAliases()
  expect(result[0]!.refName).toBe('chr1')
  expect(result[0]!.aliases).toEqual([
    'CM000663.2',
    'NC_000001.11',
    'chr1',
    '1',
  ])
  expect(result[2]!.refName).toBe('chrM')
  expect(result[2]!.aliases).toEqual(['J01415.2', 'NC_012920.1', 'chrM', 'MT'])
})

test('useNameOverride defaults to true and is carried on each alias', async () => {
  const result = await makeAdapter().getRefNameAliases()
  expect(result.every(r => r.override)).toBe(true)
})

test('useNameOverride:false is reflected on each alias', async () => {
  const result = await makeAdapter(false).getRefNameAliases()
  expect(result.every(r => !r.override)).toBe(true)
})

test('throws naming the specific missing required column', async () => {
  const adapter = new Adapter(
    configSchema.create({
      location: {
        localPath: require.resolve('./test_data/missing_ucsc_column.tsv'),
        locationType: 'LocalPathLocation',
      },
    }),
  )
  await expect(adapter.getRefNameAliases()).rejects.toThrow(
    'missing required column "UCSC style name"',
  )
})
