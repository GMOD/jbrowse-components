import { tablesAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'

import { RESOLVED_ASSEMBLIES } from './assembly.ts'
import { wholeFileBytes } from './bareHost.ts'
import { MIN_ADAPTER_BYTES, engineCache } from './cache.ts'
import {
  DEFAULT_CACHE_LIMIT,
  createTablesEngine,
  tablesPluginManager,
} from './index.ts'
import { BAM, COVERAGE_BIGWIG, DOG_VCF } from './volvox.fixture.ts'

const engine = createTablesEngine()

const copy = (i: number) => ({
  ...BAM,
  adapterConfig: {
    ...BAM.adapterConfig,
    bamLocation: {
      ...BAM.adapterConfig.bamLocation,
      uri: `${BAM.adapterConfig.bamLocation.uri}?copy=${i}`,
    },
  },
  region: { refName: 'ctgA', start: 0, end: 50_000 },
})

beforeEach(async () => {
  await engine.clearCache()
  await engine.cache({ limit: DEFAULT_CACHE_LIMIT })
})

test('a read leaves what it decoded in the cache, and clearing empties it', async () => {
  await engine.alignments(BAM)
  await engine.variants(DOG_VCF)
  await engine.wiggle(COVERAGE_BIGWIG)
  const held = await engine.cache()
  expect(held.decoded).toBeGreaterThan(0)
  expect(held.adapters).toBeGreaterThan(1)
  expect(await engine.clearCache()).toEqual({
    limit: DEFAULT_CACHE_LIMIT,
    decoded: 0,
    chunks: 0,
    parsed: 0,
    adapters: 0,
    assemblies: 0,
  })
})

test('the decoded records stay within the limit, and use all of it', async () => {
  await engine.alignments(copy(0))
  const one = (await engine.cache()).decoded
  await engine.clearCache()
  await engine.cache({ limit: 2.5 * one })
  for (let i = 0; i < 3; i++) {
    await engine.alignments(copy(i))
  }
  expect((await engine.cache()).decoded).toBe(2 * one)
  const limit = one * 3
  await engine.cache({ limit })
  for (let i = 1; i < 8; i++) {
    await engine.alignments(copy(i))
    expect((await engine.cache()).decoded).toBeLessThanOrEqual(limit)
  }
  expect((await engine.cache({ limit: 0 })).decoded).toBeLessThanOrEqual(one)
})

test('the adapters the last call read stay, past any limit', async () => {
  await engine.cache({ limit: 0 })
  await engine.alignments(copy(0))
  const perCall = (await engine.cache()).adapters
  expect(perCall).toBeGreaterThan(0)
  await engine.variants(DOG_VCF)
  expect((await engine.cache()).adapters).toBe(1)
  expect((await engine.cache({ limit: 0 })).adapters).toBe(1)
  await engine.clearCache()
  await engine.alignments(copy(0))
  expect((await engine.cache({ limit: 0 })).adapters).toBe(perCall)
})

test('a call finishing keeps the adapters a call still running holds', async () => {
  const cache = engineCache()
  await engine.cache({ limit: 0 })
  let release = () => {}
  const held = new Promise<void>(resolve => {
    release = resolve
  })
  let reading = () => {}
  const read = new Promise<void>(resolve => {
    reading = resolve
  })
  const running = cache.within(async () => {
    await tablesAdapter(tablesPluginManager(), DOG_VCF.adapterConfig, undefined)
    reading()
    await held
  })
  await read
  await cache.within(async () => {})
  expect((await engine.cache()).adapters).toBe(1)
  release()
  await running
})

test('clearing during a call keeps the adapters that call holds', async () => {
  const cache = engineCache()
  let release = () => {}
  const held = new Promise<void>(resolve => {
    release = resolve
  })
  let reading = () => {}
  const read = new Promise<void>(resolve => {
    reading = resolve
  })
  const running = cache.within(async () => {
    await tablesAdapter(tablesPluginManager(), DOG_VCF.adapterConfig, undefined)
    reading()
    await held
  })
  await read
  expect((await engine.clearCache()).adapters).toBe(1)
  release()
  await running
})

test('every engine shares one budget and one set of caches', async () => {
  await engine.cache({ limit: 32 * 2 ** 20 })
  const other = createTablesEngine()
  expect((await other.cache()).limit).toBe(32 * 2 ** 20)
  await other.cache({ limit: 64 * 2 ** 20 })
  expect((await engine.cache()).limit).toBe(64 * 2 ** 20)
  await other.alignments(BAM)
  expect((await engine.cache()).adapters).toBeGreaterThan(0)
  await engine.clearCache()
  expect((await other.cache()).adapters).toBe(0)
})

test('the engine keeps the most recently read assemblies', async () => {
  const assembly = (i: number) => ({
    name: `volvox${i}`,
    sequence: { adapter: BAM.sequenceAdapter },
  })
  for (let i = 0; i < RESOLVED_ASSEMBLIES + 4; i++) {
    await engine.regions({ assembly: assembly(i) })
  }
  expect((await engine.cache()).assemblies).toBe(RESOLVED_ASSEMBLIES)
})

test('a budget is a number of bytes, Infinity for none', async () => {
  expect((await engine.cache({ limit: Infinity })).limit).toBe(Infinity)
  for (const limit of [-1, Number.NaN, null]) {
    await expect(
      engine.cache({ limit: limit as unknown as number }),
    ).rejects.toThrow(`a cache limit is a number of bytes, not ${limit}`)
  }
})

test('an adapter trimmed while another adapter holds it keeps its weight', async () => {
  const sequence = {
    sequenceAdapter: BAM.sequenceAdapter,
    region: { refName: 'ctgA', start: 0, end: 100 },
  }
  await engine.cache({ limit: 2 * MIN_ADAPTER_BYTES })
  wholeFileBytes.set(BAM.sequenceAdapter.faiLocation.uri, MIN_ADAPTER_BYTES)
  await engine.sequence(sequence)
  const weight = (await engine.cache()).parsed
  expect(weight).toBeGreaterThan(2 * MIN_ADAPTER_BYTES)
  await engine.alignments(BAM)
  await engine.variants(DOG_VCF)
  await engine.sequence(sequence)
  expect((await engine.cache()).parsed).toBe(weight)
})
