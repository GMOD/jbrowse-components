import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import SequenceSearchAdapter from './SequenceSearchAdapter.ts'
import configSchema from './configSchema.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Region } from '@jbrowse/core/util'

// minimal in-memory sequence adapter; only getSequence is exercised
class FakeSequenceAdapter {
  constructor(private seq: string) {}
  async getSequence(region: Region) {
    return this.seq.slice(
      Math.max(0, region.start),
      Math.min(this.seq.length, region.end),
    )
  }
  async getRefNames() {
    return ['chr1']
  }
}

function makeAdapter(seq: string, extraConf: Record<string, unknown> = {}) {
  const getSubAdapter = (async () => ({
    dataAdapter: new FakeSequenceAdapter(seq),
    sessionIds: new Set<string>(),
  })) as unknown as getSubAdapterType
  return new SequenceSearchAdapter(
    configSchema.create({
      sequenceAdapter: { type: 'FakeSequenceAdapter' },
      ...extraConf,
    }),
    getSubAdapter,
  )
}

function search(
  seq: string,
  extraConf: Record<string, unknown> = {},
  region: Partial<Region> = {},
) {
  return firstValueFrom(
    makeAdapter(seq, extraConf)
      .getFeatures(
        {
          assemblyName: 'volvox',
          refName: 'chr1',
          start: 0,
          end: seq.length,
          ...region,
        },
        {},
      )
      .pipe(toArray()),
  )
}

test('finds a forward-strand match', async () => {
  //                     0123456789
  const feats = await search('AAAGAATTCAAA', {
    search: 'GAATTC',
    searchReverse: false,
  })
  expect(feats).toHaveLength(1)
  const f = feats[0]!
  expect(f.get('name')).toBe('GAATTC')
  expect(f.get('start')).toBe(3)
  expect(f.get('end')).toBe(9)
  expect(f.get('strand')).toBe(1)
})

test('reverse-strand hit is anchored on the actual sequence end', async () => {
  //                     0         1
  //                     0123456789
  // GTAATC on the plus strand is GATTAC read off the minus strand
  const feats = await search('AAGTAATCAA', {
    search: 'GATTAC',
    searchForward: false,
  })
  expect(feats).toHaveLength(1)
  const f = feats[0]!
  expect(f.get('name')).toBe('GATTAC')
  expect(f.get('start')).toBe(2)
  expect(f.get('end')).toBe(8)
  expect(f.get('strand')).toBe(-1)
})

test('searchForward=false / searchReverse=false drop their strand', async () => {
  // GAATTC is palindromic, so it is found on both strands at 3..9
  const both = await search('AAAGAATTCAAA', { search: 'GAATTC' })
  expect(both.map(f => f.get('strand')).sort()).toEqual([-1, 1])

  const fwdOnly = await search('AAAGAATTCAAA', {
    search: 'GAATTC',
    searchReverse: false,
  })
  expect(fwdOnly).toHaveLength(1)
  expect(fwdOnly[0]!.get('strand')).toBe(1)
})

test('caseInsensitive (default) matches a lowercase query, off does not', async () => {
  const insensitive = await search('AAAGAATTCAAA', {
    search: 'gaattc',
    searchReverse: false,
  })
  expect(insensitive).toHaveLength(1)

  const sensitive = await search('AAAGAATTCAAA', {
    search: 'gaattc',
    searchReverse: false,
    caseInsensitive: false,
  })
  expect(sensitive).toHaveLength(0)
})

test('empty search (the default) yields nothing', async () => {
  expect(await search('AAAGAATTCAAA')).toHaveLength(0)
})

test('matching is non-overlapping (plain global regex, unlike CRISPR/motif)', async () => {
  // AA in AAAA matches at 0 and 2, not 0/1/2 — matchAll advances past each hit
  const feats = await search('AAAA', { search: 'AA', searchReverse: false })
  expect(feats.map(f => f.get('start'))).toEqual([0, 2])
})

test('hits outside the queried window are filtered out', async () => {
  //                 0         1
  //                 012345678901234567
  const seq = 'GGGGAAAAAAAAAAGGGG'
  // GGGG at 0..4 and 14..18; query only the right half
  const feats = await search(
    seq,
    { search: 'GGGG', searchReverse: false },
    { start: 10, end: 18 },
  )
  expect(feats).toHaveLength(1)
  expect(feats[0]!.get('start')).toBe(14)
})
