import { rowRuns } from './rowRuns.ts'

test('merges adjacent rows sharing a key', () => {
  expect(rowRuns(['a', 'a', 'b'], s => s)).toEqual([
    { start: 0, end: 2, key: 'a' },
    { start: 2, end: 3, key: 'b' },
  ])
})

// `end` is exclusive so `end - start` is the row count, which is what every
// caller multiplies by the row height.
test('end is exclusive', () => {
  const [run] = rowRuns(['a', 'a', 'a'], s => s)
  expect(run).toEqual({ start: 0, end: 3, key: 'a' })
  expect(run!.end - run!.start).toBe(3)
})

// The whole reason the key is `K | undefined` rather than a predicate over
// every row: a skipped row has to BREAK the run. Bridged, the mark claims rows
// it does not describe -- an uncolored row inside a colored stripe, a row
// outside the hovered subtree highlighted along with it.
test('a skipped row breaks the run rather than being bridged', () => {
  expect(rowRuns(['a', undefined, 'a'], s => s)).toEqual([
    { start: 0, end: 1, key: 'a' },
    { start: 2, end: 3, key: 'a' },
  ])
})

test('rows with no key contribute nothing', () => {
  expect(rowRuns([undefined, undefined], s => s)).toEqual([])
  expect(rowRuns([], (s: string) => s)).toEqual([])
})

// Adjacency is by position, not by key: two runs of the same key stay two runs
// when anything sits between them.
test('non-adjacent rows of the same key stay separate runs', () => {
  expect(rowRuns(['a', 'b', 'a'], s => s)).toEqual([
    { start: 0, end: 1, key: 'a' },
    { start: 1, end: 2, key: 'b' },
    { start: 2, end: 3, key: 'a' },
  ])
})

test('passes the index to the key function', () => {
  expect(
    rowRuns(['x', 'x', 'x'], (_s, i) => (i === 1 ? undefined : 'k')),
  ).toEqual([
    { start: 0, end: 1, key: 'k' },
    { start: 2, end: 3, key: 'k' },
  ])
})
