import { mergeStopsWithin } from './navToMultiLevelBreak.ts'

// der(3)'s route: out of chr3, 199 bp on chr10, 183 bp on chr12, back into
// chr3 457 bp from where it left. Each junction's two ends, in read order.
const ends = [
  { refName: 'chr3', pos: 25_359_568 },
  { refName: 'chr10', pos: 58_717_464 },
  { refName: 'chr10', pos: 58_717_663 },
  { refName: 'chr12', pos: 72_273_295 },
  { refName: 'chr12', pos: 72_273_112 },
  { refName: 'chr3', pos: 25_359_111 },
]

test('ends a window apart on one contig share a panel, in route order', () => {
  expect(mergeStopsWithin(ends, 5000)).toEqual([
    { refName: 'chr3', pos: 25_359_340 },
    { refName: 'chr10', pos: 58_717_564 },
    { refName: 'chr12', pos: 72_273_204 },
  ])
})

test('ends further apart than the window keep their own panels', () => {
  expect(mergeStopsWithin(ends, 190)).toHaveLength(5)
  expect(mergeStopsWithin(ends, 0).map(s => s.refName)).toEqual([
    'chr3',
    'chr10',
    'chr10',
    'chr12',
    'chr12',
    'chr3',
  ])
})
