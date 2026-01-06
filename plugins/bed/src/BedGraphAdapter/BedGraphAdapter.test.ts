import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BedGraphAdapter from './BedGraphAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter() {
  return new BedGraphAdapter(
    configSchema.create({
      bedGraphLocation: {
        localPath: require.resolve('./test_data/test.bg'),
        locationType: 'LocalPathLocation',
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
