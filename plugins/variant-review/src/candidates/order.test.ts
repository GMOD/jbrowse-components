import { orderCandidates } from './order.ts'

import type { CandidateVariant } from './types.ts'

function c(refName: string, start: number, id = `${refName}:${start}`) {
  return { refName, start, end: start + 1, id } as CandidateVariant
}

test('orders by assembly region index, not lexically', () => {
  const refOrder = new Map([
    ['chr2', 0],
    ['chr10', 1],
  ])
  const sorted = orderCandidates(
    [c('chr10', 5), c('chr2', 50), c('chr2', 7)],
    refOrder,
  )
  expect(sorted.map(x => x.id)).toEqual(['chr2:7', 'chr2:50', 'chr10:5'])
})

test('ties break on end then id', () => {
  const a = { ...c('chr1', 5, 'b'), end: 9 }
  const b = { ...c('chr1', 5, 'a'), end: 9 }
  const d = { ...c('chr1', 5, 'z'), end: 6 }
  expect(
    orderCandidates([a, b, d], new Map([['chr1', 0]])).map(x => x.id),
  ).toEqual(['z', 'a', 'b'])
})
