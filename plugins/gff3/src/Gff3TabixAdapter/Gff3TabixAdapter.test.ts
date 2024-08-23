import { expect, test } from 'vitest'
import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
import configSchema from './configSchema'
import Gff3TabixAdapter from './Gff3TabixAdapter'

test('test getfeatures on gff plain text adapter', async () => {
  const adapter = new Gff3TabixAdapter(
    configSchema.create({
      gffGzLocation: {
        localPath: require.resolve('../test_data/volvox.sort.gff3.gz'),
      },
      index: {
        location: {
          localPath: require.resolve('../test_data/volvox.sort.gff3.gz.tbi'),
        },
      },
    }),
  )
  const features = adapter.getFeatures({
    refName: 'ctgB',
    start: 0,
    end: 200000,
    assemblyName: 'volvox',
  })
  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
  expect(await adapter.hasDataForRefName('ctgB')).toBe(true)
  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  // There are only 4 features in ctgB
  expect(featuresArray.length).toBe(4)
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray).toMatchSnapshot()
})
