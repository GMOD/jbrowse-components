import Adapter from './ChromSizesAdapter'
import configSchema from './configSchema'

test('adapter can fetch sequence from volvox.chrom.sizes', async () => {
  const adapter = new Adapter(
    configSchema.create({
      chromSizesLocation: {
        localPath: require.resolve('./test_data/volvox.chrom.sizes'),
      },
    }),
  )

  const regions = await adapter.getRegions()
  expect(regions).toEqual([
    {
      refName: 'ctgA',
      start: 0,
      end: 50001,
    },
    {
      refName: 'ctgB',
      start: 0,
      end: 6079,
    },
  ])
})
