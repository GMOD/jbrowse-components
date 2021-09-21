import configSchema from './configSchema'
import GtfTabixAdapter from './GtfTabixAdapter'
// import { toArray } from 'rxjs/operators'

test('can instantiate new GtfTabixAdapter and check for data', async () => {
  const adapter = new GtfTabixAdapter(
    configSchema.create({
      gtfGzLocation: {
        localPath: require.resolve('./test_data/volvox.sorted.gtf.gz'),
      },
      index: {
        location: {
          localPath: require.resolve('./test_data/volvox.sorted.gtf.gz.tbi'),
        },
      },
    }),
  )
  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
  expect(await adapter.hasDataForRefName('ctgB')).toBe(false)
})
