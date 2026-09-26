import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BedGraphAdapter from './BedGraphAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter(file = './test_data/test.bg') {
  return new BedGraphAdapter(
    configSchema.create({
      bedGraphLocation: {
        localPath: require.resolve(file),
        locationType: 'LocalPathLocation',
      },
    }),
  )
}

// What Save track data writes for a track of several subtracks
test('a source column names each row its subtrack', async () => {
  const features = await firstValueFrom(
    makeAdapter('./test_data/tidy.bg')
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'chr1',
        start: 0,
        end: 1000,
      })
      .pipe(toArray()),
  )
  expect(
    features.map(f => [f.get('source'), f.get('start'), f.get('score')]),
  ).toEqual([
    ['tumor', 100, 4],
    ['normal', 100, 7],
    ['tumor', 200, 5],
  ])
})
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
