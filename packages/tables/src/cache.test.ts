import { RESOLVED_ASSEMBLIES } from './assembly.ts'
import {
  DEFAULT_CACHE_LIMIT,
  MIN_ADAPTER_BYTES,
  createTablesEngine,
} from './index.ts'
import { BAM, DOG_VCF } from './volvox.fixture.ts'

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
})

beforeEach(async () => {
  await engine.clearCache()
  await engine.cache({ limit: DEFAULT_CACHE_LIMIT })
})

test('a read leaves what it decoded in the cache, and clearing empties it', async () => {
  await engine.alignments(BAM)
  await engine.variants(DOG_VCF)
  const held = await engine.cache()
  expect(held.decoded).toBeGreaterThan(0)
  expect(held.adapters).toBeGreaterThan(1)
  expect(await engine.clearCache()).toEqual({
    limit: DEFAULT_CACHE_LIMIT,
    decoded: 0,
    chunks: 0,
    indexes: 0,
    adapters: 0,
    assemblies: 0,
  })
})

test('the decoded records stay within three quarters of the budget', async () => {
  await engine.alignments(copy(0))
  const one = (await engine.cache()).decoded
  const limit = (one * 3) / 0.75
  await engine.cache({ limit })
  for (let i = 1; i < 8; i++) {
    await engine.alignments(copy(i))
    expect((await engine.cache()).decoded).toBeLessThanOrEqual(limit * 0.75)
  }
  expect((await engine.cache({ limit: 0 })).decoded).toBeLessThanOrEqual(one)
})

test('the adapters held weigh at most a quarter of the budget, besides the last call', async () => {
  await engine.alignments(copy(0))
  const perCall = (await engine.cache()).adapters
  const limit = 4 * (perCall + 2) * MIN_ADAPTER_BYTES
  await engine.cache({ limit })
  for (let i = 1; i < 8; i++) {
    await engine.alignments(copy(i))
  }
  const held = await engine.cache()
  expect(held.indexes).toBeLessThanOrEqual(limit / 4)
  expect(held.adapters).toBe(perCall + 2)
})

test('the adapters the last call read stay, past any budget', async () => {
  await engine.cache({ limit: 0 })
  await engine.alignments(copy(0))
  const perCall = (await engine.cache()).adapters
  expect(perCall).toBeGreaterThan(0)
  await engine.variants(DOG_VCF)
  expect((await engine.cache()).adapters).toBe(1)
  expect((await engine.cache({ limit: 0 })).adapters).toBe(0)
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
