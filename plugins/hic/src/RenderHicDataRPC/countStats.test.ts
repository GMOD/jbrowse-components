import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import {
  INSTANCE_STRIDE_WORDS,
  setInstanceCount,
  setInstancePosition,
} from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { computeCountStats } from './countStats.ts'
import { executeRenderHicData } from './executeRenderHicData.ts'
import { toContacts } from './testContacts.ts'

import type { HicDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

const RES = 10

async function statsFor(counts: number[]) {
  const contacts = toContacts(
    counts.map((c, i) => ({
      bin1: i,
      bin2: i,
      counts: c,
      region1Idx: 0,
      region2Idx: 0,
    })),
    RES,
  )
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getMultiRegionContactRecords: () => Promise.resolve(contacts),
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const res = await executeRenderHicData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions: [{ refName: 'a', start: 0, end: 1000, assemblyName: 'a' }],
      axisBlocks: [{ refName: 'a', offsetBp: 0 }],
      originBp: 0,
      resolution: RES,
      normalization: 'KR',
    },
  })
  const { maxScore, percentile95, numContacts } = (
    res as unknown as { value: HicDataResult }
  ).value
  return { maxScore, percentile95, numContacts }
}

// 100 ascending counts, so the 95th percentile is a distinct, checkable value
// rather than coinciding with the max.
const ASCENDING = Array.from({ length: 100 }, (_, i) => i + 1)

describe('hic count statistics', () => {
  test('reads max and the 95th percentile off the sorted counts', async () => {
    const { maxScore, percentile95 } = await statsFor(ASCENDING)
    expect(maxScore).toBe(100)
    // floor(0.95 * 99) = 94 -> the 95th of the ascending values
    expect(percentile95).toBe(95)
  })

  test('an empty result scores zero rather than reading off an empty array', async () => {
    expect(await statsFor([])).toEqual({
      maxScore: 0,
      percentile95: 0,
      numContacts: 0,
    })
  })

  // A typed-array sort puts NaN last, so scoring off the raw counts made a
  // single non-finite value the max. NaN then propagates through
  // `Math.max(colorMaxScore, ...)` in both the shader and `mapHicCount`, so
  // every bin's color maps to NaN and the legend disappears (`hasLegendData`
  // reads `NaN > 0`). Both non-finites are reachable from a real file: NaN is
  // the .hic dense-block "no value" marker, which only the dense parse path
  // filters, and a tiny normalization divisor yields Infinity.
  test.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('one %s count does not poison the color scale', async (_name, bad) => {
    const { maxScore, percentile95, numContacts } = await statsFor([
      ...ASCENDING,
      bad,
    ])
    expect(maxScore).toBe(100)
    expect(percentile95).toBe(95)
    // the bad contact is still drawn (as its own bin), only excluded from scoring
    expect(numContacts).toBe(101)
  })

  test('all-non-finite counts score zero, so hasLegendData reads false', async () => {
    const { maxScore, percentile95 } = await statsFor([
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])
    expect(maxScore).toBe(0)
    expect(percentile95).toBe(0)
  })
})

// `computeCountStats` reads counts out of the packed instance buffer at stride,
// so a fixture that is only about the counts still has to put them where the
// count field lives. Written through the shader's own setter; positions are
// irrelevant to these cases and stay zero.
function asInstances(counts: ArrayLike<number>) {
  const out = new Float32Array(counts.length * INSTANCE_STRIDE_WORDS)
  for (let i = 0; i < counts.length; i++) {
    setInstanceCount(out, i, counts[i]!)
  }
  return out
}

// The two statistics used to come off a full sort of the finite subset. That is
// still the clearest definition of the right answer, so it stays here as a
// differential oracle for the selection that replaced it.
function reference(counts: Float32Array) {
  const finite = counts.filter(c => Number.isFinite(c))
  if (finite.length === 0) {
    return { maxScore: 0, percentile95: 0 }
  }
  finite.sort()
  return {
    maxScore: finite[finite.length - 1]!,
    percentile95: finite[Math.floor(0.95 * (finite.length - 1))]!,
  }
}

// deterministic, so a failure is reproducible
function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x1_0000_0000
  }
}

describe('computeCountStats matches a full sort', () => {
  // Each shape targets a different way selection can go wrong: all-equal and
  // few-distinct stress the partition's equal-element handling, and the sorted
  // pair is the pre-sorted input a naive pivot degrades on — which is the shape
  // real contacts actually have, since counts correlate with distance from the
  // diagonal.
  const shapes: [string, (n: number, rnd: () => number) => number][] = [
    ['uniform', (_n, rnd) => rnd() * 1000],
    ['skewed', (_n, rnd) => (rnd() < 0.98 ? rnd() * 5 : rnd() * 100000)],
    ['all equal', () => 7],
    ['few distinct', (_n, rnd) => Math.floor(rnd() * 3)],
    ['ascending', i => i],
    ['descending', (i, _r) => -i],
    [
      'with non-finites',
      (_n, rnd) => (rnd() < 0.02 ? Number.NaN : rnd() * 100),
    ],
  ]

  test.each(shapes)('%s', (_name, gen) => {
    for (const n of [0, 1, 2, 3, 19, 100, 1001, 5000]) {
      const rnd = lcg(n + 1)
      const counts = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        counts[i] = gen(i, rnd)
      }
      expect({ n, ...computeCountStats(asInstances(counts), n) }).toEqual({
        n,
        ...reference(counts),
      })
    }
  })
})

test('computeCountStats leaves its input untouched', () => {
  // it permutes a copy; permuting the instance buffer itself would scramble the
  // array that transfers to the renderer AS THE VERTEX BUFFER — so it would
  // move bins on screen, not just recolor them
  const instances = asInstances([5, 1, 9, 3, 7, 2])
  setInstancePosition(instances, 0, 11, 22)
  const before = [...instances]
  computeCountStats(instances, 6)
  expect([...instances]).toEqual(before)
})

test('a pre-sorted million counts selects without quadratic blowup', () => {
  // guards the median-of-three pivot: a first-element pivot on sorted input
  // partitions one element at a time, which at this size does not finish
  const n = 1_000_000
  const counts = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    counts[i] = i
  }
  const t0 = Date.now()
  const { maxScore, percentile95 } = computeCountStats(asInstances(counts), n)
  expect(maxScore).toBe(n - 1)
  expect(percentile95).toBe(Math.floor(0.95 * (n - 1)))
  expect(Date.now() - t0).toBeLessThan(2000)
})
