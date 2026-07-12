import PluginManager from '@jbrowse/core/PluginManager'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import GCContentAdapter from './GCContentAdapter.ts'
import configSchemaF from './configSchema.ts'

import type { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

const configSchema = configSchemaF(new PluginManager())

function makeAdapter(
  sequence: string,
  gcMode = 'content',
  windowSize = 10,
  windowDelta = 10,
) {
  // Only the two methods used by GCContentAdapter need to exist; cast through
  // unknown so we don't have to stub the rest of BaseSequenceAdapter.
  const sequenceAdapter = {
    getRefNames: async () => ['ctgA'],
    getSequence: async ({ start, end }: { start: number; end: number }) =>
      sequence.slice(Math.max(0, start), Math.min(sequence.length, end)),
  } as unknown as BaseSequenceAdapter
  return new GCContentAdapter(
    configSchema.create({
      type: 'GCContentAdapter',
      sequenceAdapter: { type: 'MockSequenceAdapter' },
      windowSize,
      windowDelta,
      gcMode,
    }),
    async () => ({ dataAdapter: sequenceAdapter, sessionIds: new Set() }),
  )
}

function getFeatures(adapter: GCContentAdapter, start = 0, end = 100) {
  return firstValueFrom(
    adapter
      .getFeatures({ refName: 'ctgA', start, end, assemblyName: 'a' })
      .pipe(toArray()),
  )
}

async function getScores(adapter: GCContentAdapter, start = 0, end = 100) {
  const features = await getFeatures(adapter, start, end)
  return features.map(f => f.get('score')!)
}

test('getRefNames delegates to the sequence subadapter', async () => {
  expect(await makeAdapter('ACGT').getRefNames()).toEqual(['ctgA'])
})

test('all-GC sequence gives score 1', async () => {
  const scores = await getScores(makeAdapter('G'.repeat(200)))
  expect(scores.length).toBeGreaterThan(0)
  for (const s of scores) {
    expect(s).toBeCloseTo(1)
  }
})

test('all-AT sequence gives score 0', async () => {
  const scores = await getScores(makeAdapter('A'.repeat(200)))
  expect(scores.length).toBeGreaterThan(0)
  for (const s of scores) {
    expect(s).toBeCloseTo(0)
  }
})

test('balanced GC/AT sequence gives score 0.5', async () => {
  // 'AC' repeated = ACACACAC... exactly 50% GC in every 10bp window
  const scores = await getScores(makeAdapter('AC'.repeat(100)))
  expect(scores.length).toBeGreaterThan(0)
  for (const s of scores) {
    expect(s).toBeCloseTo(0.5)
  }
})

test('returns no features when query is past the end of the sequence', async () => {
  expect(await getScores(makeAdapter('ACGT'.repeat(10)), 10000, 11000)).toEqual(
    [],
  )
})

test('skew mode: all-G sequence gives skew +1', async () => {
  const scores = await getScores(makeAdapter('G'.repeat(200), 'skew'))
  expect(scores.length).toBeGreaterThan(0)
  for (const s of scores) {
    expect(s).toBeCloseTo(1)
  }
})

test('skew mode: all-C sequence gives skew -1', async () => {
  const scores = await getScores(makeAdapter('C'.repeat(200), 'skew'))
  expect(scores.length).toBeGreaterThan(0)
  for (const s of scores) {
    expect(s).toBeCloseTo(-1)
  }
})

test('skew mode: balanced GC sequence gives skew 0', async () => {
  // 'GC' repeated has equal G and C in every window
  const scores = await getScores(makeAdapter('GC'.repeat(100), 'skew'))
  expect(scores.length).toBeGreaterThan(0)
  for (const s of scores) {
    expect(s).toBeCloseTo(0)
  }
})

test('overlapping windows (windowDelta < windowSize) score correctly', async () => {
  // 'AC' repeated is exactly 50% GC in every 10bp window at any phase, so the
  // overlapping-window (windowDelta 2 < windowSize 10) path must still give 0.5
  const scores = await getScores(makeAdapter('AC'.repeat(100), 'content', 10, 2))
  expect(scores.length).toBeGreaterThan(0)
  for (const s of scores) {
    expect(s).toBeCloseTo(0.5)
  }
})

test('lowercase n is excluded from the GC denominator', async () => {
  // 5 G + 5 n per 10bp window -> GC fraction is 5/5, not 5/10, since n is not a
  // valid base
  const scores = await getScores(makeAdapter('GGGGGnnnnn'.repeat(20)))
  expect(scores.length).toBeGreaterThan(0)
  for (const s of scores) {
    expect(s).toBeCloseTo(1)
  }
})

test('same genomic window scores identically across differing query offsets', async () => {
  const seq = 'GCATTAGCCGATatgcNNNNGGCC'.repeat(20)
  const a = await getFeatures(makeAdapter(seq), 40, 200)
  const b = await getFeatures(makeAdapter(seq), 137, 263)
  const byStart = new Map(a.map(f => [f.get('start'), f.get('score')]))
  const overlap = b.filter(f => byStart.has(f.get('start')))
  expect(overlap.length).toBeGreaterThan(0)
  for (const f of overlap) {
    expect(f.get('score')).toBeCloseTo(byStart.get(f.get('start'))!)
  }
})
