import { blocksOf } from './alignmentBlocks.ts'

const WINDOW = 27_000

function placed(
  start: number,
  end: number,
  record?: string,
  weight = end - start,
) {
  return { placement: { start, end }, weight, record }
}

const byRecord = (p: { record?: string }) => p.record

// SV-ins-10k-100k: one walk's record split at its 54 kb insertion
test('the runs of one record a window and more apart are one block', () => {
  const runs = [placed(0, 13_000, 'walk'), placed(67_000, 81_000, 'walk')]
  expect(blocksOf(runs, WINDOW).map(b => [b.lo, b.hi])).toEqual([
    [0, 13_000],
    [67_000, 81_000],
  ])
  expect(
    blocksOf(runs, WINDOW, undefined, { joinOf: byRecord }).map(b => [
      b.lo,
      b.hi,
    ]),
  ).toEqual([[0, 81_000]])
})

test('two records a window and more apart stay two blocks', () => {
  const runs = [placed(0, 13_000, 'a'), placed(67_000, 81_000, 'b')]
  expect(
    blocksOf(runs, WINDOW, undefined, { joinOf: byRecord }).map(b => [
      b.lo,
      b.hi,
    ]),
  ).toEqual([
    [0, 13_000],
    [67_000, 81_000],
  ])
})

test('a stray holding a run of a solid record is solid, and joins its block', () => {
  const runs = [placed(0, 26_000, 'walk'), placed(200_000, 200_100, 'walk')]
  expect(
    blocksOf(runs, WINDOW, undefined, { joinOf: byRecord }).map(b => [
      b.lo,
      b.hi,
    ]),
  ).toEqual([[0, 200_100]])
})

test('without the floor no cluster is set aside', () => {
  const runs = [placed(0, 26_000), placed(200_000, 200_100)]
  expect(blocksOf(runs, WINDOW).map(b => [b.lo, b.hi])).toEqual([[0, 26_000]])
  expect(
    blocksOf(runs, WINDOW, undefined, { floor: false }).map(b => [b.lo, b.hi]),
  ).toEqual([
    [0, 26_000],
    [200_000, 200_100],
  ])
})
