import { LocalFile } from 'generic-filehandle2'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import bamConfigSchema from '../BamAdapter/configSchema.ts'
import CramAdapter from '../CramAdapter/CramAdapter.ts'
import { SequenceAdapter } from '../CramAdapter/CramTestAdapters.ts'
import cramConfigSchema from '../CramAdapter/configSchema.ts'
import SamAdapter from '../SamAdapter/SamAdapter.ts'
import samConfigSchema from '../SamAdapter/configSchema.ts'
import { buildBaseFeatureData } from './buildBaseFeatureData.ts'
import { buildBaseReadArrays } from './buildBaseReadArrays.ts'
import { readIdAt, readIdPrefixOf, readKeyOf } from './readIdentity.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'

// getVolvoxSequenceSubAdapter ignores it and returns the test adapter
const sequenceAdapterConfig = { type: 'TestSequenceAdapter' }

const query = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 1,
  end: 10200,
}

const getVolvoxSequenceSubAdapter: getSubAdapterType = async () => ({
  dataAdapter: new SequenceAdapter(
    new LocalFile(require.resolve('../../test_data/volvox.fa')),
  ),
  sessionIds: new Set(),
})

function localPath(path: string) {
  return { localPath: require.resolve(path), locationType: 'LocalPathLocation' }
}

async function bamFeatures() {
  const adapter = new BamAdapter(
    bamConfigSchema.create({
      bamLocation: localPath('../../test_data/volvox-sorted.bam'),
      index: { location: localPath('../../test_data/volvox-sorted.bam.bai') },
    }),
    getVolvoxSequenceSubAdapter,
  )
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)
  return firstValueFrom(adapter.getFeatures(query).pipe(toArray()))
}

async function cramFeatures() {
  const adapter = new CramAdapter(
    cramConfigSchema.create({
      cramLocation: localPath('../../test_data/volvox-sorted.cram'),
      craiLocation: localPath('../../test_data/volvox-sorted.cram.crai'),
    }),
    getVolvoxSequenceSubAdapter,
  )
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)
  return firstValueFrom(adapter.getFeatures(query).pipe(toArray()))
}

async function samFeatures() {
  // A SAM record's id is its line-derived uniqueId with no numeric record id
  // behind it, so this is the string branch — the same one the PAF/synteny
  // blocks LGVSyntenyDisplay pushes through this pipeline take.
  const bam = await bamFeatures()
  const lines = bam
    .slice(0, 20)
    .map(f =>
      [
        f.get('name'),
        f.get('flags'),
        f.get('refName'),
        f.get('start') + 1,
        f.get('score'),
        f.get('CIGAR'),
        '*',
        0,
        0,
        f.get('seq'),
        '*',
      ].join('\t'),
    )
  const adapter = new SamAdapter(
    samConfigSchema.create({
      samText: ['@SQ\tSN:ctgA\tLN:50001', ...lines, ''].join('\n'),
    }),
    getVolvoxSequenceSubAdapter,
  )
  adapter.setSequenceAdapterConfig(sequenceAdapterConfig)
  return firstValueFrom(adapter.getFeatures(query).pipe(toArray()))
}

// The whole contract in one line: whatever the branch, spelling key `i` through
// the prefix gives back exactly what `feature.id()` would have returned. Every
// consumer that still needs a string — `featureIdUnderMouse`, the details
// fetch, the tooltip — depends only on this.
function expectIdsRoundTrip(features: Feature[]) {
  const readIdPrefix = readIdPrefixOf(features)
  const data = features.map(f => buildBaseFeatureData(f, readIdPrefix))
  const { readArrays } = buildBaseReadArrays(data, readIdPrefix)
  expect(features.length).toBeGreaterThan(0)
  expect(readArrays.readKeys.length).toBe(features.length)
  for (let i = 0; i < features.length; i++) {
    expect(readIdAt(readArrays, i)).toBe(features[i]!.id())
  }
  return readArrays
}

test('BAM ships numeric keys that spell back to feature.id()', async () => {
  const features = await bamFeatures()
  const readArrays = expectIdsRoundTrip(features)
  expect(readArrays.readKeys).toBeInstanceOf(Float64Array)
  expect(readArrays.readIdPrefix).toMatch(/-$/)
}, 20000)

test('CRAM ships numeric keys that spell back to feature.id()', async () => {
  const features = await cramFeatures()
  const readArrays = expectIdsRoundTrip(features)
  expect(readArrays.readKeys).toBeInstanceOf(Float64Array)
  expect(readArrays.readIdPrefix).toMatch(/-$/)
}, 20000)

test('SAM keeps whole id strings — no record id to key on', async () => {
  const features = await samFeatures()
  const readArrays = expectIdsRoundTrip(features)
  expect(Array.isArray(readArrays.readKeys)).toBe(true)
  expect(readArrays.readIdPrefix).toBeUndefined()
}, 20000)

describe('readIdPrefixOf', () => {
  const feat = (id: string, recordId?: number) =>
    ({ id: () => id, recordId }) as { id: () => string; recordId?: number }

  test('strips the record id off a real id()', () => {
    expect(readIdPrefixOf([feat('J9v2mQ1xKp-90210', 90210)])).toBe(
      'J9v2mQ1xKp-',
    )
  })

  // fileOffset 0 is the first record of a BAM, so the prefix must survive it.
  test('handles record id 0', () => {
    expect(readIdPrefixOf([feat('abc-0', 0)])).toBe('abc-')
  })

  test('is undefined without a record id', () => {
    expect(readIdPrefixOf([feat('some-read-id')])).toBeUndefined()
    expect(readIdPrefixOf([])).toBeUndefined()
  })

  // The check is what stops a feature class whose id() is built some other way
  // from shipping keys that spell back to the wrong string.
  test('is undefined when id() does not end in the record id', () => {
    expect(readIdPrefixOf([feat('unrelated', 7)])).toBeUndefined()
  })
})

describe('readKeyOf', () => {
  test('prefers the record id, including 0', () => {
    expect(readKeyOf({ id: () => 'a-0', recordId: 0 })).toBe(0)
    expect(readKeyOf({ id: () => 'a-5', recordId: 5 })).toBe(5)
  })

  test('falls back to the id string', () => {
    expect(readKeyOf({ id: () => 'plain' })).toBe('plain')
  })
})

describe('readIdAt', () => {
  test('spells a numeric key through the prefix', () => {
    expect(
      readIdAt({ readKeys: new Float64Array([7]), readIdPrefix: 'abc-' }, 0),
    ).toBe('abc-7')
  })

  test('returns a string key untouched', () => {
    expect(readIdAt({ readKeys: ['xyz'], readIdPrefix: undefined }, 0)).toBe(
      'xyz',
    )
  })

  test('is undefined past the end, as `readIds[i]` was', () => {
    expect(
      readIdAt({ readKeys: [], readIdPrefix: undefined }, 0),
    ).toBeUndefined()
  })
})

describe('buildBaseReadArrays key branch', () => {
  const feat = (id: number | string) => ({
    id,
    name: '',
    start: 0,
    end: 1,
    flags: 0,
    mapq: 0,
    insertSize: 0,
    pairOrientation: 0,
    strand: 1,
  })

  test('a prefix with numeric keys gives one transferable', () => {
    const { readArrays } = buildBaseReadArrays([feat(1), feat(2)], 'a-')
    expect(readArrays.readKeys).toEqual(new Float64Array([1, 2]))
  })

  // Can't arise from one adapter, but if it ever did the fallback must still
  // spell every id the same way — the numbers through the prefix, the strings
  // as they are.
  test('a mixed set falls back to strings without losing the prefix', () => {
    const { readArrays } = buildBaseReadArrays([feat(1), feat('odd')], 'a-')
    expect(readArrays.readKeys).toEqual(['a-1', 'odd'])
  })
})
