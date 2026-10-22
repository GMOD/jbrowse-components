import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import GCContentAdapter from './GCContentAdapter.ts'
import configSchemaF from './configSchema.ts'

import type { GCStep } from './gcWindow.ts'
import type { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

const configSchema = configSchemaF(new PluginManager())

function makeAdapter(
  sequence: string,
  op = 'content',
  window = 10,
  step?: GCStep,
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
      op,
      window,
      ...(step === undefined ? {} : { step }),
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

// The shape a config should be written in: no `sequenceAdapter` at all. The
// adapter is built with the sequence of the assembly the request named, and
// reads it through `getSequenceSubAdapter` like every other one that scans the
// reference. Before that it read its own slot and nothing else, so a GC track
// had to copy the assembly's sequence adapter into itself — five configs in
// this repo did, two of them repeating the assembly's own FASTA urls.
test('scores off the assembly when no sequenceAdapter is configured', async () => {
  const adapter = new GCContentAdapter(
    configSchema.create({
      type: 'GCContentAdapter',
      window: 10,
      step: 10,
    }),
    async () => ({
      dataAdapter: {
        getRefNames: async () => ['ctgA'],
        getSequence: async () => 'G'.repeat(200),
      } as unknown as BaseSequenceAdapter,
      sessionIds: new Set<string>(),
    }),
    undefined,
    { type: 'FromTheAssembly' },
  )
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
    /built with no reference: the request that created it named no assembly/,
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

test('overlapping windows (step < window) score correctly', async () => {
  // 'AC' repeated is exactly 50% GC in every 10bp window at any phase, so the
  // overlapping-window (step 2 < window 10) path must still give 0.5
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

// The case above uses step === window, where snapping the fetch to either one
// happens to give the same grid. The sampling positions advance by the step, so
// that is the modulus that has to be snapped to: with a window grid these two
// queries shared *zero* positions, and panning slid the whole curve rather
// than extending it.
test('the sampling grid is global when the step does not divide the window', async () => {
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
  // window 10 centered on each position, stepping 10: the window at
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

test('window 1 scores every base including the first and last', async () => {
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

// The wiggle displays read `getFeatureArrays`, and the arrays are sized ahead
// of the walk. A size formula that over-allocates leaves zero-filled bins at
// position 0 that no feature ever reported, so every configuration's count has
// to land exactly on the buffers' length.
test.each([
  ['defaults', 'A'.repeat(1000), 100, 100, 0, 1000],
  ['delta does not divide window', 'A'.repeat(300), 10, 3, 40, 200],
  ['single-base window', 'GATC', 1, 1, 0, 4],
  ['query past the sequence', 'A'.repeat(50), 100, 100, 200, 300],
])(
  'the arrays hold exactly the bins the walk wrote: %s',
  async (_label, seq, window, step, start, end) => {
    const adapter = makeAdapter(seq, 'content', window, step)
    const [arrays] = await adapter.getFeatureArrays([
      { refName: 'ctgA', start, end, assemblyName: 'a' },
    ])
    expect(arrays!.count).toBe(arrays!.starts.length)
    const features = await getFeatures(adapter, start, end)
    expect(features.length).toBe(arrays!.count)
  },
)

test('a window of Ns gets no bin, rather than a GC content of 0', async () => {
  const seq = 'G'.repeat(20) + 'N'.repeat(30) + 'G'.repeat(20)
  const features = await getFeatures(makeAdapter(seq), 0, 70)
  expect(features.map(f => [f.get('start'), f.get('score')])).toEqual([
    [0, 1],
    [10, 1],
    [50, 1],
    [60, 1],
  ])
})

test('skew has no bin over a window with no G or C', async () => {
  const features = await getFeatures(
    makeAdapter('A'.repeat(20) + 'G'.repeat(20), 'skew'),
    0,
    40,
  )
  expect(features.map(f => [f.get('start'), f.get('score')])).toEqual([
    [20, 1],
    [30, 1],
  ])
})

test('an odd window scores exactly that many bases', async () => {
  const features = await getFeatures(
    makeAdapter(`GGA${'A'.repeat(30)}`, 'content', 3, 3),
    0,
    9,
  )
  expect(features[0]!.get('start')).toBe(0)
  expect(features[0]!.get('end')).toBe(3)
  expect(features[0]!.get('score')).toBeCloseTo(2 / 3)
})

test('an auto step with no zoom to follow tiles the windows', async () => {
  const features = await getFeatures(
    makeAdapter('A'.repeat(200), 'content', 50, 'auto'),
    0,
    200,
  )
  expect(features.map(f => [f.get('start'), f.get('end')])).toEqual([
    [0, 50],
    [50, 100],
    [100, 150],
    [150, 200],
  ])
})

test('a step wider than the window widens the window to it', async () => {
  // window 2 at step 10 would score 2 bases of every 10; widened, each bin is
  // the whole 10 it is drawn over: GG + 8 A is 0.2, not the 1 of its middle
  const features = await getFeatures(
    makeAdapter('AAAAGGAAAA'.repeat(10), 'content', 2, 10),
    0,
    100,
  )
  expect(features.map(f => [f.get('start'), f.get('end')])).toEqual(
    Array.from({ length: 10 }, (_, i) => [i * 10, i * 10 + 10]),
  )
  for (const f of features) {
    expect(f.get('score')).toBeCloseTo(0.2)
  }
})

test('a step of 0 scores every base rather than looping', async () => {
  const features = await getFeatures(
    makeAdapter('A'.repeat(100), 'content', 20, 0),
    0,
    100,
  )
  const starts = features.map(f => f.get('start'))
  expect(starts.length).toBeGreaterThan(0)
  expect(starts).toEqual(starts.map((_, i) => starts[0]! + i))
})

test('only A, C, G and T count toward the fraction', async () => {
  // R (A or G) and S (C or G) are in neither the count nor the denominator
  const scores = await getScores(makeAdapter('GGGAARRSSS'.repeat(20)))
  expect(scores.length).toBeGreaterThan(0)
  for (const s of scores) {
    expect(s).toBeCloseTo(3 / 5)
  }
})

test('an auto step follows the zoom and declares the rung it serves', async () => {
  const adapter = makeAdapter('A'.repeat(2000), 'content', 10, 'auto')
  const region = { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'a' }
  const [arrays] = await adapter.getFeatureArrays([region], { bpPerPx: 7 })
  expect(arrays!.ends[0]! - arrays!.starts[0]!).toBe(5)
  expect(await adapter.getZoomRange({ bpPerPx: 7 })).toEqual({
    minBpPerPx: 5,
    maxBpPerPx: 10,
  })
  const [coarse] = await adapter.getFeatureArrays([region], { bpPerPx: 60 })
  // step 50 widens the 10 bp window to 50, so bins tile
  expect(coarse!.starts[1]! - coarse!.starts[0]!).toBe(50)
  expect(coarse!.ends[0]! - coarse!.starts[0]!).toBe(50)
})

test('a fixed step serves every zoom', async () => {
  const adapter = makeAdapter('A'.repeat(100), 'content', 10, 10)
  expect(await adapter.getZoomRange({ bpPerPx: 7 })).toBeUndefined()
})

test("v4's windowSize, windowDelta and gcMode load as window, step and op", () => {
  const conf = configSchema.create({
    type: 'GCContentAdapter',
    windowSize: 30,
    windowDelta: 10,
    gcMode: 'skew',
  })
  expect(
    (['window', 'step', 'op'] as const).map(k => readConfObject(conf, k)),
  ).toEqual([30, 10, 'skew'])
})
