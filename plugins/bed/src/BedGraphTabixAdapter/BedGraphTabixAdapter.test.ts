import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BedGraphTabixAdapter from './BedGraphTabixAdapter'
import configSchema from './configSchema'

function makeAdapter() {
  return new BedGraphTabixAdapter(
    configSchema.create({
      bedGraphGzLocation: {
        localPath: require.resolve('./test_data/test.bg.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve('./test_data/test.bg.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
}
test('basic', async () => {
  const adapter = makeAdapter()

  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'chr1',
        start: 0,
        end: 10000,
      })
      .pipe(toArray()),
  )

  expect(features).toMatchSnapshot()
})
