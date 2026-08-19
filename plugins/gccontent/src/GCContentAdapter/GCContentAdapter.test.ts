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

// The shape a config should be written in: no `sequenceAdapter` at all. The RPCs
// prime `sequenceAdapterConfig` from the assembly the track is displayed
// against, and this adapter reads it through `getSequenceSubAdapter` like every
// other one that scans the reference. Before that it read its own slot and
// nothing else, so a GC track had to copy the assembly's sequence adapter into
// itself — five configs in this repo did, two of them repeating the assembly's
// own FASTA urls.
test('scores off the assembly when no sequenceAdapter is configured', async () => {
  const adapter = new GCContentAdapter(
    configSchema.create({
      type: 'GCContentAdapter',
      windowSize: 10,
      windowDelta: 10,
    }),
    async () => ({
      dataAdapter: {
        getRefNames: async () => ['ctgA'],
        getSequence: async () => 'G'.repeat(200),
      } as unknown as BaseSequenceAdapter,
      sessionIds: new Set<string>(),
    }),
  )
  adapter.setSequenceAdapterConfig({ type: 'FromTheAssembly' })
  expect(await getScores(adapter)).not.toHaveLength(0)
  expect(new Set(await getScores(adapter))).toEqual(new Set([1]))
})

// The failure it used to give was `Error getting subadapter`, which named
// neither the track nor what to do about it.
test('says what is missing when neither the assembly nor the slot supplies one', async () => {
  const adapter = new GCContentAdapter(
    configSchema.create({ type: 'GCContentAdapter' }),
    async () => ({
      dataAdapter: {} as unknown as BaseSequenceAdapter,
      sessionIds: new Set<string>(),
    }),
  )
  await expect(adapter.getRefNames()).rejects.toThrow(
    /No sequence adapter available/,
  )
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
  const scores = await getScores(
    makeAdapter('AC'.repeat(100), 'content', 10, 2),
  )
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

// The case above uses windowDelta === windowSize, where snapping the fetch to
// either one happens to give the same grid. The sampling positions step by
// windowDelta, so that is the modulus that has to be snapped to: with a
// windowSize grid these two queries shared *zero* positions, and panning slid
// the whole curve rather than extending it.
test('the sampling grid is global when windowDelta does not divide windowSize', async () => {
  const seq = 'GCATTAGCCGATatgcNNNNGGCC'.repeat(40)
  const a = await getFeatures(makeAdapter(seq, 'content', 10, 3), 40, 200)
  const b = await getFeatures(makeAdapter(seq, 'content', 10, 3), 137, 263)
  const byStart = new Map(a.map(f => [f.get('start'), f.get('score')]))
  const overlap = b.filter(f => byStart.has(f.get('start')))
  // the two queries overlap over ~60bp, so at a 3bp step they must share many
  // positions, not merely one or two by coincidence
  expect(overlap.length).toBeGreaterThan(10)
  for (const f of overlap) {
    expect(f.get('score')).toBeCloseTo(byStart.get(f.get('start'))!)
  }
})

test('the bin is centered on the window it scores', async () => {
  // windowSize 10 centered on each position, stepping 10: the window at
  // position 5 is [0,10), so its bin must be [0,10) too — anchoring the bin at
  // the position drew it over [5,15) instead.
  const features = await getFeatures(makeAdapter('A'.repeat(60)), 0, 40)
  expect(features.slice(0, 3).map(f => [f.get('start'), f.get('end')])).toEqual(
    [
      [0, 10],
      [10, 20],
      [20, 30],
    ],
  )
})

test('windowSize 1 scores every base including the first and last', async () => {
  // the window is [i, i+1), so every base of the contig has one — the bound
  // used to reserve a half-window of slop on both sides regardless
  const features = await getFeatures(makeAdapter('GATC', 'content', 1, 1), 0, 4)
  expect(features.map(f => [f.get('start'), f.get('score')])).toEqual([
    [0, 1],
    [1, 0],
    [2, 0],
    [3, 1],
  ])
})
