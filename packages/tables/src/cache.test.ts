import {
  CACHED_ADAPTERS,
  DEFAULT_CACHE_LIMIT,
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
    read: 0,
    adapters: 0,
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

test('the engine keeps the adapters it read most recently', async () => {
  for (let i = 0; i < CACHED_ADAPTERS + 5; i++) {
    await engine.alignments(copy(i))
  }
  expect((await engine.cache()).adapters).toBeLessThanOrEqual(CACHED_ADAPTERS)
})

test('a budget is a number of bytes', async () => {
  await expect(engine.cache({ limit: -1 })).rejects.toThrow(
    'a cache limit is a number of bytes, not -1',
  )
})
