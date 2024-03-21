import Adapter from './ChromSizesAdapter'
import configSchema from './configSchema'

test('adapter can fetch sequence from volvox.chrom.sizes', async () => {
  const adapter = new Adapter(
    configSchema.create({
      chromSizesLocation: {
        localPath: require.resolve('./test_data/volvox.chrom.sizes'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const regions = await adapter.getRegions()
  expect(regions).toEqual([
    {
      end: 50001,
      refName: 'ctgA',
      start: 0,
    },
    {
      end: 6079,
      refName: 'ctgB',
      start: 0,
    },
  ])
})
