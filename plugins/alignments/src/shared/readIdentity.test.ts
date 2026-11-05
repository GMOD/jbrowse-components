import { readIdAt, readKeyOf, recordIdsAreIds } from '@jbrowse/alignments-core'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import bamConfigSchema from '../BamAdapter/configSchema.ts'
import CramAdapter from '../CramAdapter/CramAdapter.ts'
import {
  getVolvoxSequenceSubAdapter,
  volvoxReference,
} from '../CramAdapter/CramTestAdapters.fixture.ts'
import cramConfigSchema from '../CramAdapter/configSchema.ts'
import SamAdapter from '../SamAdapter/SamAdapter.ts'
import samConfigSchema from '../SamAdapter/configSchema.ts'
import { buildBaseFeatureData } from './buildBaseFeatureData.ts'
import { buildBaseReadArrays } from './buildBaseReadArrays.ts'

import type { Feature } from '@jbrowse/core/util'

const query = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 1,
  end: 10200,
}

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
    undefined,
    volvoxReference,
  )
  return firstValueFrom(adapter.getFeatures(query).pipe(toArray()))
}

async function cramFeatures() {
  const adapter = new CramAdapter(
    cramConfigSchema.create({
      cramLocation: localPath('../../test_data/volvox-sorted.cram'),
      craiLocation: localPath('../../test_data/volvox-sorted.cram.crai'),
    }),
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
  )
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
    undefined,
    volvoxReference,
  )
  return firstValueFrom(adapter.getFeatures(query).pipe(toArray()))
}

// The whole contract in one line: whatever the branch, spelling key `i` gives
// back exactly what `feature.id()` would have returned. Every consumer that
// still needs a string — `featureIdUnderMouse`, the details fetch, the tooltip
// — depends only on this.
function expectIdsRoundTrip(features: Feature[]) {
  const numericKeys = recordIdsAreIds(features)
  const data = features.map(f => buildBaseFeatureData(f, numericKeys))
  const { readArrays } = buildBaseReadArrays(data, numericKeys)
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
}, 20000)

test('CRAM ships numeric keys that spell back to feature.id()', async () => {
  const features = await cramFeatures()
  const readArrays = expectIdsRoundTrip(features)
  expect(readArrays.readKeys).toBeInstanceOf(Float64Array)
}, 20000)

test('SAM keeps whole id strings — no record id to key on', async () => {
  const features = await samFeatures()
  const readArrays = expectIdsRoundTrip(features)
  expect(Array.isArray(readArrays.readKeys)).toBe(true)
}, 20000)

describe('recordIdsAreIds', () => {
  const feat = (id: string, recordId?: number) => ({ id: () => id, recordId })

  test('holds when id() is the record id', () => {
    expect(recordIdsAreIds([feat('90210', 90210)])).toBe(true)
  })

  // fileOffset 0 is the first record of a BAM
  test('handles record id 0', () => {
    expect(recordIdsAreIds([feat('0', 0)])).toBe(true)
  })

  test('fails without a record id', () => {
    expect(recordIdsAreIds([feat('some-read-id')])).toBe(false)
    expect(recordIdsAreIds([])).toBe(false)
  })

  // The check is what stops a feature class whose id() is built some other way
  // from shipping keys that spell back to the wrong string.
  test('fails when id() is not the record id', () => {
    expect(recordIdsAreIds([feat('abc-7', 7)])).toBe(false)
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
  test('spells a numeric key', () => {
    expect(readIdAt({ readKeys: new Float64Array([7]) }, 0)).toBe('7')
  })

  test('returns a string key untouched', () => {
    expect(readIdAt({ readKeys: ['xyz'] }, 0)).toBe('xyz')
  })

  test('is undefined past the end', () => {
    expect(readIdAt({ readKeys: [] }, 0)).toBeUndefined()
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

  test('numeric keys give one transferable', () => {
    const { readArrays } = buildBaseReadArrays([feat(1), feat(2)], true)
    expect(readArrays.readKeys).toEqual(new Float64Array([1, 2]))
  })

  // Can't arise from one adapter, but if it ever did the fallback must still
  // spell every id the way `readIdAt` would.
  test('a mixed set falls back to strings', () => {
    const { readArrays } = buildBaseReadArrays([feat(1), feat('odd')], true)
    expect(readArrays.readKeys).toEqual(['1', 'odd'])
  })
})
