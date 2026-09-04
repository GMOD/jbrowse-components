import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { AssemblyNotInAdapterError } from '../PairwiseAdapterBase.ts'
import Adapter from './PAFAdapter.ts'
import MyConfigSchema from './configSchema.ts'
import { getWeightedMeans } from './util.ts'

import type { PAFRecord } from './util.ts'

function makeRecord(
  qname: string,
  tname: string,
  mappingQual: number | undefined,
  blockLen: number,
  numMatches?: number,
): PAFRecord {
  return {
    qname,
    qstart: 0,
    qend: blockLen,
    tname,
    tstart: 0,
    tend: blockLen,
    strand: 1,
    extra: { mappingQual, blockLen, numMatches },
  }
}

test('getWeightedMeans computes a true length-weighted mean identity per pair', () => {
  // Two alignments in the same pair: 90% identity over 1000bp and 50% over
  // 1000bp → length-weighted mean = (0.9*1000 + 0.5*1000)/2000 = 0.7.
  const records = [
    makeRecord('q1', 't1', 60, 1000, 900),
    makeRecord('q1', 't1', 60, 1000, 500),
  ]
  getWeightedMeans(records)
  expect(records[0]!.extra.meanIdentity).toBeCloseTo(0.7)
  expect(records[1]!.extra.meanIdentity).toBeCloseTo(0.7)
})

// A `${qname}-${tname}` key made these one pair, so each averaged the other's
// identity. Contig names carrying the separator are ordinary (HLA-A, scaffold-1).
test('two pairs whose joined names collide stay separate', () => {
  const records = [
    makeRecord('HLA-A', 'B', 60, 1000, 900),
    makeRecord('HLA', 'A-B', 60, 1000, 500),
  ]
  getWeightedMeans(records)
  expect(records[0]!.extra.meanIdentity).toBeCloseTo(0.9)
  expect(records[1]!.extra.meanIdentity).toBeCloseTo(0.5)
})

// A contig name is data, and on a plain object `map['constructor']` finds
// Object rather than a missing entry, so the running sum lands on the
// constructor and reads back NaN.
test('a contig named like an Object property gets a real mean', () => {
  const records = [makeRecord('constructor', 'constructor', 60, 1000, 900)]
  getWeightedMeans(records)
  expect(records[0]!.extra.meanIdentity).toBeCloseTo(0.9)
})

// 0/0 rode out to the identity color ramp as a NaN
test('a pair with no block length to weight means zero, not NaN', () => {
  const records = [makeRecord('q1', 't1', 60, 0, 0)]
  getWeightedMeans(records)
  expect(records[0]!.extra.meanIdentity).toBe(0)
})

function makeAdapter() {
  return new Adapter(
    MyConfigSchema.create({
      pafLocation: {
        localPath: require.resolve('./test_data/peach_grape.paf'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['peach', 'grape'],
    }),
  )
}

test('adapter can fetch features from peach_grape.paf', async () => {
  const adapter = makeAdapter()

  const features1 = adapter.getFeatures({
    refName: 'Pp01',
    start: 0,
    end: 200000,
    assemblyName: 'peach',
  })

  const features2 = adapter.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 200000,
    assemblyName: 'grape',
  })

  const fa1 = await firstValueFrom(features1.pipe(toArray()))
  const fa2 = await firstValueFrom(features2.pipe(toArray()))
  expect(fa1.length).toBe(11)
  expect(fa2.length).toBe(5)
  expect(fa1[0]!.get('refName')).toBe('Pp01')
  expect(fa2[0]!.get('refName')).toBe('chr1')
  // walking one contig's bucket rather than the whole file must not reorder
  // the result: syntenyId is the record's position in the file
  const ids = fa1.map(f => f.get('syntenyId') as number)
  expect(ids).toEqual([...ids].sort((a, b) => a - b))
})

test('getFeatures refuses an unknown assembly even when its refName collides with a target name', async () => {
  const adapter = makeAdapter()
  // 'chr1' is a grape (target) refName; an unknown assembly must not borrow
  // target-side features just because the refName happens to match
  await expect(
    firstValueFrom(
      adapter
        .getFeatures({
          refName: 'chr1',
          start: 0,
          end: 200000,
          assemblyName: 'unknown',
        })
        .pipe(toArray()),
    ),
  ).rejects.toThrow(AssemblyNotInAdapterError)
})

test('getRefNames returns query ref names for query assembly', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames({
    assemblyName: 'peach',
  })
  expect(refNames).toContain('Pp01')
})

test('getRefNames returns target ref names for target assembly', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames({
    assemblyName: 'grape',
  })
  expect(refNames).toContain('chr1')
})

test('getRefNames returns empty for unknown assembly', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames({
    assemblyName: 'unknown',
  })
  expect(refNames).toEqual([])
})

test('getRefNames returns empty when no regions provided', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames({})
  expect(refNames).toEqual([])
})

// An assembly this adapter doesn't carry has the same answer whatever the file
// says, so it must not be read: this used to download and parse a whole PAF —
// gigabytes, for an in-memory adapter — to return []. A location that cannot be
// opened is how the test sees that no read happened.
test('an assembly this adapter has no side for is answered without reading the file', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      pafLocation: {
        localPath: '/nonexistent/never-read.paf',
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['peach', 'grape'],
    }),
  )
  await expect(adapter.getRefNames({})).resolves.toEqual([])
  await expect(adapter.getRefNames({ assemblyName: 'mouse' })).resolves.toEqual(
    [],
  )
})

// The per-contig index a query walks must report exactly the contigs the query
// can emit for, on the side the assembly is anchored on
test('getRefNames reports only its own side of the file', async () => {
  const adapter = makeAdapter()
  const peach = await adapter.getRefNames({ assemblyName: 'peach' })
  const grape = await adapter.getRefNames({ assemblyName: 'grape' })
  expect(peach.every(n => n.startsWith('Pp'))).toBe(true)
  expect(grape.every(n => n.startsWith('chr'))).toBe(true)
  expect(peach).not.toEqual(grape)
})

// A tab-delimited column that isn't a `TAG:t:value` used to be filed under a
// key one character short of itself and spread onto the feature
test('a trailing non-tag column is not carried onto the feature', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'paf-tag-')), 'in.paf')
  writeFileSync(
    path,
    'q1\t1000\t100\t200\t+\tt1\t2000\t300\t400\t95\t100\t60\tjunk\tNM:i:5\n',
  )
  const adapter = new Adapter(
    MyConfigSchema.create({
      pafLocation: { localPath: path, locationType: 'LocalPathLocation' },
      assemblyNames: ['q', 't'],
    }),
  )
  const [f] = await firstValueFrom(
    adapter
      .getFeatures({ refName: 't1', start: 0, end: 1000, assemblyName: 't' })
      .pipe(toArray()),
  )
  expect(f!.get('NM')).toBe('5')
  expect(f!.get('jun')).toBeUndefined()
})

// odgi untangle writes its identity as an `id:f:` tag. It feeds the feature's
// identity, but must not land in the feature data as `id` — the synteny tooltip
// falls back to that for a name, so such a row labelled itself "0.98".
test('an id:f: tag becomes identity, not the feature name', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'paf-id-')), 'in.paf')
  writeFileSync(
    path,
    'q1\t1000\t100\t200\t+\tt1\t2000\t300\t400\t95\t100\t60\tid:f:0.98\n',
  )
  const adapter = new Adapter(
    MyConfigSchema.create({
      pafLocation: { localPath: path, locationType: 'LocalPathLocation' },
      assemblyNames: ['q', 't'],
    }),
  )
  const [f] = await firstValueFrom(
    adapter
      .getFeatures({ refName: 't1', start: 0, end: 1000, assemblyName: 't' })
      .pipe(toArray()),
  )
  expect(f!.get('identity')).toBeCloseTo(0.98)
  expect(f!.get('id')).toBeUndefined()
})

// A self-alignment names one assembly on both sides — a genome against its own
// paralogy, which is what a whole-genome-duplication PAF is. Picking the side
// by first match answered the query columns for every query, so every row
// anchored on the target columns was dropped and half the alignment never drew.
function makeSelfAdapter() {
  const path = join(mkdtempSync(join(tmpdir(), 'paf-self-')), 'self.paf')
  writeFileSync(
    path,
    'ctgA\t1000\t100\t200\t+\tctgB\t2000\t300\t400\t95\t100\t60\n' +
      'ctgC\t1000\t0\t100\t+\tctgC\t1000\t500\t600\t95\t100\t60\n',
  )
  return new Adapter(
    MyConfigSchema.create({
      pafLocation: { localPath: path, locationType: 'LocalPathLocation' },
      assemblyNames: ['vvx', 'vvx'],
    }),
  )
}

test('a self-alignment serves a contig that only the target columns name', async () => {
  const features = await firstValueFrom(
    makeSelfAdapter()
      .getFeatures({
        refName: 'ctgB',
        start: 0,
        end: 2000,
        assemblyName: 'vvx',
      })
      .pipe(toArray()),
  )
  expect(features.length).toBe(1)
  expect(features[0]!.get('refName')).toBe('ctgB')
  expect(features[0]!.get('start')).toBe(300)
  expect(features[0]!.get('mate')).toMatchObject({ refName: 'ctgA' })
})

test('a self-alignment reports both sides of the file as its refNames', async () => {
  const refNames = await makeSelfAdapter().getRefNames({ assemblyName: 'vvx' })
  expect([...refNames].sort()).toEqual(['ctgA', 'ctgB', 'ctgC'])
})

// Both ends of a row within one contig face the query, and each has to draw
// against the other, so they are two features and cannot share a uniqueId.
test('a self-alignment draws both ends of a row anchored on one contig', async () => {
  const features = await firstValueFrom(
    makeSelfAdapter()
      .getFeatures({
        refName: 'ctgC',
        start: 0,
        end: 1000,
        assemblyName: 'vvx',
      })
      .pipe(toArray()),
  )
  expect(features.map(f => f.get('start')).sort((a, b) => a - b)).toEqual([
    0, 500,
  ])
  expect(new Set(features.map(f => f.id())).size).toBe(2)
})

// Many PAFs carry each alignment twice, once written from each end — minimap2
// run both ways, or the volvox_contig_swap fixture below. Serving both sides
// then reaches one alignment twice, as its own query row and as its mirror's
// target row, and the view painted the ribbon on top of itself.
test('a self-alignment written in both directions draws each alignment once', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      pafLocation: {
        localPath:
          require.resolve('../../../../test_data/volvox/volvox_contig_swap.paf'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['volvox', 'volvox'],
    }),
  )
  const onCtgA = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'ctgA',
        start: 0,
        end: 50001,
        assemblyName: 'volvox',
      })
      .pipe(toArray()),
  )
  const onCtgB = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'ctgB',
        start: 0,
        end: 6079,
        assemblyName: 'volvox',
      })
      .pipe(toArray()),
  )
  expect(onCtgA.length).toBe(1)
  expect(onCtgB.length).toBe(1)
  expect(onCtgA[0]!.get('mate')).toMatchObject({ refName: 'ctgB' })
  expect(onCtgB[0]!.get('mate')).toMatchObject({ refName: 'ctgA' })
})
