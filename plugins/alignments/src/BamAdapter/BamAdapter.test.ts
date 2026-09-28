import { statusMessageText } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import {
  getVolvoxSequenceSubAdapter,
  volvoxReference,
} from '../CramAdapter/CramTestAdapters.ts'
import Adapter from './BamAdapter.ts'
import configSchema from './configSchema.ts'

import type { SequenceAdapter } from '../CramAdapter/CramTestAdapters.ts'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

// the reference a fetch of MD-less reads compares against; the RPC path builds
// the adapter with it, so a bare construction has to hand it over the same way

// extended_cigar.bam is against hg19, which the volvox reference has no contig
// of; its =/X operations carry the mismatches, and this is what the adapter
// sees when the reference holds no sequence for the region
const getReferenceWithoutContig: getSubAdapterType = async () => ({
  dataAdapter: {
    getRefNames: async () => [],
    getSequence: async () => undefined,
  } as unknown as SequenceAdapter,
  sessionIds: new Set(),
})

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
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
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
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
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
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
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
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
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
    getReferenceWithoutContig,
    undefined,
    volvoxReference,
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
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
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

// The extract skips the SA lookup for a read with no clip at either end, on
// the SAM rule that every record of a chimeric alignment is clipped; this
// holds that rule to a real file of split reads
test('every read carrying SA is clipped at an end', async () => {
  const bam = require.resolve('../../../../test_data/volvox/volvox-sv.bam')
  const adapter = new Adapter(
    configSchema.create({
      bamLocation: { localPath: bam, locationType: 'LocalPathLocation' },
      index: {
        location: {
          localPath: `${bam}.bai`,
          locationType: 'LocalPathLocation',
        },
      },
    }),
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
  )
  const reads = (await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 0,
        end: 50000,
      })
      .pipe(toArray()),
  )) as unknown as { getTag: (t: string) => unknown; hasEndClip: boolean }[]
  const withSA = reads.filter(r => r.getTag('SA') !== undefined)
  expect(withSA.length).toBeGreaterThan(0)
  expect(withSA.every(r => r.hasEndClip)).toBe(true)
})
