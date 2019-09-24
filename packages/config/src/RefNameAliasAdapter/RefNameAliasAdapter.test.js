import { toArray } from 'rxjs/operators'
import Adapter from './RefNameAliasAdapter.ts'

test('adapter can fetch features', async () => {
  const features = [
    { uniqueId: 'one', refName: 'ctgA', start: 20, end: 40 },
    { uniqueId: 'two', refName: 'ctgB', start: 50, end: 60 },
  ]
  const adapter = new Adapter({
    location: { localPath: require.resolve('./test_data/simple_alias.txt') },
  })
  const result = await adapter.getRefNameAliases()
  expect(result[0].refName).toBe('chr1')
  expect(result[0].aliases).toEqual(['1', 'NC_000001.10'])
  expect(result[1].refName).toBe('chr2')
  expect(result[1].aliases).toEqual(['2', 'NC_000002.11'])
})
