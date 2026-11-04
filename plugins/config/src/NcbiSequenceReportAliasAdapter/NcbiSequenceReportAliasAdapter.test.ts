import Adapter from './NcbiSequenceReportAliasAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter(useNameOverride?: boolean, file = 'sequence_report.tsv') {
  return new Adapter(
    configSchema.create({
      location: {
        localPath: require.resolve(`./test_data/${file}`),
        locationType: 'LocalPathLocation',
      },
      ...(useNameOverride === undefined ? {} : { useNameOverride }),
    }),
  )
}

const rolesOf = (aliases: Awaited<ReturnType<Adapter['getRefNameAliases']>>) =>
  aliases.map(({ refName, role, molecule }) => ({ refName, role, molecule }))

test('carries each sequence role and molecule type', async () => {
  expect(rolesOf(await makeAdapter().getRefNameAliases())).toEqual([
    { refName: 'chr1', role: 'assembled-molecule', molecule: 'Chromosome' },
    { refName: 'chr2', role: 'assembled-molecule', molecule: 'Chromosome' },
    { refName: 'chrM', role: 'assembled-molecule', molecule: 'Mitochondrion' },
    {
      refName: 'chr1_KI270706v1_random',
      role: 'unlocalized-scaffold',
      molecule: 'Chromosome',
    },
    {
      refName: 'chrUn_GL000195v1',
      role: 'unplaced-scaffold',
      molecule: 'Chromosome',
    },
    {
      refName: 'chr1_GL383518v1_alt',
      role: 'alt-scaffold',
      molecule: 'Chromosome',
    },
  ])
})

test('reads the assembly_report.txt spelling of the same table', async () => {
  const result = await makeAdapter(
    undefined,
    'assembly_report.txt',
  ).getRefNameAliases()
  expect(result[0]!.aliases).toEqual([
    'CM000663.2',
    'NC_000001.11',
    'chr1',
    '1',
  ])
  expect(rolesOf(result)).toEqual([
    { refName: 'chr1', role: 'assembled-molecule', molecule: 'Chromosome' },
    { refName: 'chrM', role: 'assembled-molecule', molecule: 'Mitochondrion' },
    {
      refName: 'chrUn_GL000195v1',
      role: 'unplaced-scaffold',
      molecule: undefined,
    },
    {
      refName: 'chr1_KQ458382v1_alt',
      role: 'novel-patch',
      molecule: 'Chromosome',
    },
  ])
})

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
