import { statusMessageText } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './BamAdapter.ts'
import configSchema from './configSchema.ts'

// Regression: once the index is cached, a second fetch (after a small pan/zoom)
// must not re-flash "Downloading index" — it only downloads alignments
test('emits "Downloading index" on first fetch only, not once cached', async () => {
  const adapter = new Adapter(
    configSchema.create({
      bamLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
  const query = {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  }
  const collect = async () => {
    const seen: string[] = []
    await firstValueFrom(
      adapter
        .getFeatures(query, {
          statusCallback: s => {
            seen.push(statusMessageText(s) ?? '')
          },
        })
        .pipe(toArray()),
    )
    return seen
  }

  const first = await collect()
  const second = await collect()

  expect(first).toContain('Downloading index')
  expect(second).not.toContain('Downloading index')
  expect(second).toContain('Downloading alignments')
})

test('adapter can fetch features from volvox.bam', async () => {
  const adapter = new Adapter(
    configSchema.create({
      bamLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  expect(featuresArray[0]!.get('refName')).toBe('ctgA')
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(3809)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()

  expect(adapter.refIdToName(0)).toBe('ctgA')
  expect(adapter.refIdToName(1)).toBe(undefined)

  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)

  const adapterCSI = new Adapter(
    configSchema.create({
      bamLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam'),
        locationType: 'LocalPathLocation',
      },
      index: {
        indexType: 'CSI',
        location: {
          localPath: require.resolve('../../test_data/volvox-sorted.bam.csi'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )

  const featuresCSI = adapterCSI.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })
  const featuresArrayCSI = await firstValueFrom(featuresCSI.pipe(toArray()))
  const featuresJsonArrayCSI = featuresArrayCSI.map(f => f.toJSON())
  expect(featuresJsonArrayCSI).toEqual(featuresJsonArray)
})

test('test usage of BamSlightlyLazyFeature toJSON (used in the widget)', async () => {
  const adapter = new Adapter(
    configSchema.create({
      bamLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
          locationType: 'LocalPathLocation',
        },
        indexType: 'BAI',
      },
    }),
  )

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  const f = featuresArray[0]!.toJSON()
  expect(f.refName).toBe('ctgA')
  expect(f.start).toBe(2)
  expect(f.end).toBe(102)
  expect(f.mismatches).not.toBeTruthy()
})

test('test usage of BamSlightlyLazyFeature for extended CIGAR', async () => {
  const adapter = new Adapter(
    configSchema.create({
      bamLocation: {
        localPath: require.resolve('../../test_data/extended_cigar.bam'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/extended_cigar.bam.bai'),
          locationType: 'LocalPathLocation',
        },
        indexType: 'BAI',
      },
    }),
  )

  const features = adapter.getFeatures({
    assemblyName: 'hg19',
    refName: '1',
    start: 13260,
    end: 13340,
  })
  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  const f = featuresArray[0]!
  expect(f.get('mismatches')).toMatchSnapshot()
})

// 1740 of the 2464 reads in spliced.bam carry an N; the two settings partition
// the fetch, so the sum is the unfiltered count.
test('the spliced filter partitions reads by a CIGAR skip', async () => {
  const adapter = new Adapter(
    configSchema.create({
      bamLocation: {
        localPath: require.resolve('../../../../test_data/volvox/spliced.bam'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath:
            require.resolve('../../../../test_data/volvox/spliced.bam.bai'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
  const query = {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 50000,
  }
  const count = async (spliced?: 'only' | 'exclude') =>
    (
      await firstValueFrom(
        adapter
          .getFeatures(query, {
            filterBy: { flagInclude: 0, flagExclude: 0, spliced },
          })
          .pipe(toArray()),
      )
    ).length
  const all = await count()
  const only = await count('only')
  const exclude = await count('exclude')
  expect(only).toBeGreaterThan(0)
  expect(exclude).toBeGreaterThan(0)
  expect(only + exclude).toBe(all)
})
