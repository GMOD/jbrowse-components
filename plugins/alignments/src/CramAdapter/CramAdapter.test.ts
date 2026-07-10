import { getClip } from '@jbrowse/cigar-utils'
import PluginManager from '@jbrowse/core/PluginManager'
import { statusMessageText } from '@jbrowse/core/util'
import { LocalFile } from 'generic-filehandle2'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './CramAdapter.ts'
import { SequenceAdapter } from './CramTestAdapters.ts'
import configSchema from './configSchema.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

const pluginManager = new PluginManager()

const getVolvoxSequenceSubAdapter: getSubAdapterType = async () => {
  return {
    dataAdapter: new SequenceAdapter(
      new LocalFile(require.resolve('../../test_data/volvox.fa')),
    ),
    sessionIds: new Set(),
  }
}

// Mock sequenceAdapter config - the actual config doesn't matter since
// getVolvoxSequenceSubAdapter ignores it and returns the test adapter
const sequenceAdapterConfig = { type: 'TestSequenceAdapter' }

function makeAdapter(arg: string) {
  return new Adapter(
    configSchema.create({
      cramLocation: {
        localPath: require.resolve(arg),
        locationType: 'LocalPathLocation',
      },
      craiLocation: {
        localPath: require.resolve(`${arg}.crai`),
        locationType: 'LocalPathLocation',
      },
    }),
    getVolvoxSequenceSubAdapter,
    pluginManager,
  )
}

test('adapter can fetch features from volvox-sorted.cram', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')
  // Set sequenceAdapterConfig on adapter (normally done by CoreGetRefNames)
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)

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
})

// Regression: the .crai index downloads once (in setup, during the first
// fetch). A second fetch after a small pan/zoom reuses it and must not re-flash
// "Downloading index" — it only downloads alignments.
test('emits "Downloading index" on first fetch only, not once cached', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)
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

test('test usage of cramSlightlyLazyFeature toJSON (used in the widget)', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')
  // Set sequenceAdapterConfig on adapter (normally done by CoreGetRefNames)
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)

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
  // don't pass the mismatches to the frontend
  expect(f.mismatches).toEqual(undefined)
})

test('clipLengthAtStartOfRead matches getClip(CIGAR) for every record', async () => {
  const adapter = makeAdapter('../../test_data/volvox-sorted.cram')
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })
  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  expect(featuresArray.length).toBeGreaterThan(0)
  for (const feature of featuresArray) {
    const cigar = feature.get('CIGAR') as string
    const strand = feature.get('strand')!
    expect(feature.get('clipLengthAtStartOfRead')).toBe(getClip(cigar, strand))
  }
})
