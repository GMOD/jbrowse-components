import { staleHandleIds } from './fileHandleStore.ts'

// jsdom has no IndexedDB, so the transactions in this module never run under
// jest; the pruning decision is the part that is testable on its own.
function ids(n: number, base = 1_700_000_000_000) {
  return Array.from({ length: n }, (_, i) => `fh${base + i}-${i}`)
}

test('nothing is stale below the cap', () => {
  expect(staleHandleIds(ids(200))).toEqual([])
})

test('the oldest beyond the cap are stale, newest kept', () => {
  const keys = ids(205)
  const stale = staleHandleIds(keys)
  expect(stale).toHaveLength(5)
  // the five oldest, i.e. the five lowest timestamps
  expect(stale).toEqual(keys.slice(0, 5).reverse())
  // the row just written is the newest and always survives
  expect(stale).not.toContain(keys.at(-1))
})

test('does not mutate the caller array', () => {
  const keys = ids(205)
  const before = [...keys]
  staleHandleIds(keys)
  expect(keys).toEqual(before)
})

// The tradeoff MAX_STORED_HANDLES documents. A re-pick reuses the original id
// (findStoredHandleId hands it back), so reopening a file never reaches this
// function at all: a file opened every day since its id was minted is dropped
// ahead of one picked a single time yesterday. Pinned so the docstring and the
// behaviour can't drift apart again.
test('a re-picked file is not freshened — only mint time decides', () => {
  const daily = 'fh1700000000000-0' // first picked long ago, reopened daily
  const pickedOnce = ids(200, 1_800_000_000_000) // each picked once, recently
  expect(staleHandleIds([daily, ...pickedOnce])).toEqual([daily])
})

test('ids in an unrecognized format sort oldest and are dropped first', () => {
  const keys = ['legacy-key', ...ids(200)]
  expect(staleHandleIds(keys)).toEqual(['legacy-key'])
})
