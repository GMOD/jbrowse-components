import Adapter from './RefNameAliasAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter(file: string, extra?: Record<string, unknown>) {
  return new Adapter(
    configSchema.create({
      location: {
        localPath: require.resolve(`./test_data/${file}`),
        locationType: 'LocalPathLocation',
      },
      ...extra,
    }),
  )
}

test('adapter can fetch a simple alias file', async () => {
  const result = await makeAdapter('simple_alias.txt').getRefNameAliases()
  expect(result[0]!.refName).toBe('chr1')
  expect(result[0]!.aliases).toEqual(['chr1', '1', 'NC_000001.10'])
  expect(result[1]!.refName).toBe('chr2')
  expect(result[1]!.aliases).toEqual(['chr2', '2', 'NC_000002.11'])
})

test('selects the refName column by header name', async () => {
  const result = await makeAdapter('header_alias.txt', {
    refNameColumnHeaderName: 'name',
  }).getRefNameAliases()
  expect(result[0]!.refName).toBe('chr1')
  expect(result[0]!.aliases).toEqual(['chr1', '1', 'NC_000001.11'])
})

test('throws when the named header column is absent', async () => {
  await expect(
    makeAdapter('header_alias.txt', {
      refNameColumnHeaderName: 'nonexistent',
    }).getRefNameAliases(),
  ).rejects.toThrow('refNameColumnHeaderName "nonexistent" not found')
})
