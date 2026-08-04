import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BedGraphTabixAdapter from './BedGraphTabixAdapter.ts'
import configSchema from './configSchema.ts'

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

// A bedGraph whose header is a plain row skipped with `tabix -S 1` rather than
// a `#` comment. tabix's getHeader() returns nothing for those, so the value
// columns used to come back unnamed with no error anywhere — the track drew,
// the names were just gone.
test('names value columns from a skip-line header', async () => {
  const adapter = new BedGraphTabixAdapter(
    configSchema.create({
      bedGraphGzLocation: {
        localPath: require.resolve('./test_data/skipline.bg.gz'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve('./test_data/skipline.bg.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
  expect(await adapter.getNames()).toEqual([
    'chrom',
    'start',
    'end',
    'gain',
    'loss',
  ])
})
