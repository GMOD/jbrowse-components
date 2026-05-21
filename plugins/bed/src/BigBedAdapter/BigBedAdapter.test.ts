import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BigBedAdapter from './BigBedAdapter.ts'
import configSchema from './configSchema.ts'

// The EDEN gene in volvox.bb has 3 transcripts (EDEN.1, EDEN.2, EDEN.3) sharing
// geneName "EDEN". When aggregateField="geneName", they should be grouped under one
// parent gene feature. This exercises the aggregation path that was refactored to
// use featureData2's output instead of a separate parser.parseLine call.
test('adapter aggregates transcripts sharing the same geneName into a gene parent', async () => {
  const adapter = new BigBedAdapter(
    configSchema.create({
      bigBedLocation: {
        localPath: require.resolve('./test_data/volvox.bb'),
        locationType: 'LocalPathLocation',
      },
      aggregateField: 'geneName',
    }),
  )

  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 0,
        end: 20000,
      })
      .pipe(toArray()),
  )

  const eden = features.find(f => f.get('name') === 'EDEN')
  expect(eden).toBeDefined()
  expect(eden!.get('type')).toBe('gene')
  const subs = eden!.get('subfeatures') as { get(k: string): unknown }[]
  // EDEN.1, EDEN.2, EDEN.3 should all be under the EDEN gene
  expect(subs.length).toBe(3)
  expect(subs.map(s => s.get('name')).sort()).toEqual([
    'EDEN.1',
    'EDEN.2',
    'EDEN.3',
  ])
  // Each sub should be an mRNA
  for (const sub of subs) {
    expect(sub.get('type')).toBe('mRNA')
  }
})

test('adapter can fetch features from volvox.bb', async () => {
  const adapter = new BigBedAdapter(
    configSchema.create({
      bigBedLocation: {
        localPath: require.resolve('./test_data/volvox.bb'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })
  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
  expect(await adapter.hasDataForRefName('ctgB')).toBe(false)

  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray).toMatchSnapshot()
})
