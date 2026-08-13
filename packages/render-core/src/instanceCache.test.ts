import { createInstanceCache } from './instanceCache.ts'

// The plugin-side tests (synteny's and dotplot's `instanceInterleave.test.ts`)
// check that a recolor through the cache lands byte-identical to a full
// re-interleave OF THEIR layout — the part that depends on the offsets each
// passes in. What is checked here is the part that doesn't: when the cache
// re-packs, when it patches, and when it does neither. Get that wrong and the
// screen shows stale geometry, which no rendering test can distinguish from a
// data problem.

const STRIDE_WORDS = 3
const COLOR_WORD = 2

interface Data {
  geom: Float32Array
  colors: Uint32Array
}

function makeCache() {
  let packs = 0
  const cache = createInstanceCache<Data>({
    geomToken: d => d.geom,
    colors: d => d.colors,
    interleave: d => {
      packs++
      const buf = new ArrayBuffer(d.colors.length * STRIDE_WORDS * 4)
      const u32 = new Uint32Array(buf)
      for (let i = 0; i < d.colors.length; i++) {
        u32[i * STRIDE_WORDS] = d.geom[i]!
        u32[i * STRIDE_WORDS + COLOR_WORD] = d.colors[i]!
      }
      return buf
    },
    strideWords: STRIDE_WORDS,
    colorOffsetWords: COLOR_WORD,
  })
  return { cache, packs: () => packs }
}

const geom = Float32Array.from([10, 20])
const data = (colors: number[]): Data => ({
  geom,
  colors: Uint32Array.from(colors),
})

test('identical data re-packs nothing', () => {
  const { cache, packs } = makeCache()
  const d = data([1, 2])
  expect(cache.get(0, d)).toBe(cache.get(0, d))
  expect(packs()).toBe(1)
})

test('a recolor patches the colour lane in place, leaving geometry alone', () => {
  const { cache, packs } = makeCache()
  const first = cache.get(0, data([1, 2]))
  const patched = cache.get(0, data([7, 8]))

  expect(patched).toBe(first)
  expect(packs()).toBe(1)
  expect([...new Uint32Array(patched)]).toEqual([10, 0, 7, 20, 0, 8])
})

test('new geometry re-packs', () => {
  const { cache, packs } = makeCache()
  const first = cache.get(0, data([1, 2]))
  const repacked = cache.get(0, {
    geom: Float32Array.from([30, 40]),
    colors: Uint32Array.from([1, 2]),
  })

  expect(repacked).not.toBe(first)
  expect(packs()).toBe(2)
  expect([...new Uint32Array(repacked)]).toEqual([30, 0, 1, 40, 0, 2])
})

// The write-back is the easiest line to leave out of a hand-rolled copy, and
// leaving it out is invisible: the pixels stay right and every recolor re-patches
// forever.
test('a repeated recolor patches once', () => {
  const { cache } = makeCache()
  cache.get(0, data([1, 2]))
  const recolored = data([7, 8])
  cache.get(0, recolored)
  const buf = cache.get(0, recolored)
  // Corrupt the lane behind the cache's back: a second patch would rewrite it.
  new Uint32Array(buf)[COLOR_WORD] = 0xdead
  expect([...new Uint32Array(cache.get(0, recolored))]).toEqual([
    10, 0, 0xdead, 20, 0, 8,
  ])
})

test('keys are independent, and delete drops only its own', () => {
  const { cache, packs } = makeCache()
  const a = cache.get(0, data([1, 2]))
  const b = cache.get(1, data([3, 4]))
  expect(a).not.toBe(b)

  cache.delete(0)
  expect(cache.get(1, data([3, 4]))).toBe(b)
  expect(cache.get(0, data([1, 2]))).not.toBe(a)
  expect(packs()).toBe(3)
})

test('clear drops every key', () => {
  const { cache } = makeCache()
  const a = cache.get(0, data([1, 2]))
  cache.clear()
  expect(cache.get(0, data([1, 2]))).not.toBe(a)
})
