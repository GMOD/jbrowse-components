import { groupHitsByQuery } from './groupHits.ts'

function hit(uniqueId: string, queryName?: string) {
  return { uniqueId, refName: 'chr1', start: 0, end: 10, queryName }
}

const ids = (groups: ReturnType<typeof groupHitsByQuery>) =>
  groups.map(({ query, hits }) => [query, hits.map(h => h.uniqueId)])

// hits arrive best-first across every query, which interleaves them
test('hits group under their query, in submission order, best-first within', () => {
  const features = [
    hit('h0', 'r1_right_clip'),
    hit('h1', 'r1_left_clip'),
    hit('h2', 'r1_right_clip'),
  ]
  expect(
    ids(groupHitsByQuery(features, ['r1_left_clip', 'r1_right_clip'])),
  ).toEqual([
    ['r1_left_clip', ['h1']],
    ['r1_right_clip', ['h0', 'h2']],
  ])
})

test('a query that found nothing keeps its row', () => {
  expect(ids(groupHitsByQuery([hit('h0', 'a')], ['a', 'b']))).toEqual([
    ['a', ['h0']],
    ['b', []],
  ])
})

test('a hit naming a query that was not submitted is kept, after the rest', () => {
  expect(
    ids(groupHitsByQuery([hit('h0', 'renamed'), hit('h1', 'a')], ['a'])),
  ).toEqual([
    ['a', ['h1']],
    ['renamed', ['h0']],
  ])
})

// hgPcr products carry no queryName and arrive with no submitted names, so
// the list stays flat
test('results with no query names are one group', () => {
  expect(ids(groupHitsByQuery([hit('p0'), hit('p1')], []))).toEqual([
    ['', ['p0', 'p1']],
  ])
})
