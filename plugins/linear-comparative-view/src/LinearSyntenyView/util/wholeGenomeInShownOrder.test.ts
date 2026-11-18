import { wholeGenomeInShownOrder } from './wholeGenomeInShownOrder.ts'

const whole = ['chr1', 'chr2', 'chr3', 'chr4'].map(refName => ({
  refName,
  start: 0,
  end: 100,
}))

const names = (regions: { refName: string; reversed?: boolean }[]) =>
  regions.map(r => `${r.refName}${r.reversed ? '-' : ''}`)

test('a re-ordered row keeps its order and its flips', () => {
  expect(
    names(
      wholeGenomeInShownOrder(whole, [
        { refName: 'chr3' },
        { refName: 'chr1', reversed: true },
        { refName: 'chr4' },
        { refName: 'chr2' },
      ]),
    ),
  ).toEqual(['chr3', 'chr1-', 'chr4', 'chr2'])
})

test('chromosomes the row is not showing follow in assembly order', () => {
  expect(
    names(
      wholeGenomeInShownOrder(whole, [
        { refName: 'chr4', reversed: true },
        { refName: 'chr2' },
      ]),
    ),
  ).toEqual(['chr4-', 'chr2', 'chr1', 'chr3'])
})

test('a row narrowed to one contig takes the assembly order back', () => {
  expect(
    names(
      wholeGenomeInShownOrder(whole, [{ refName: 'chr3', reversed: true }]),
    ),
  ).toEqual(['chr1', 'chr2', 'chr3', 'chr4'])
})

test('the whole extent comes back, not the window the row was showing', () => {
  const [first] = wholeGenomeInShownOrder(whole, [
    { refName: 'chr2' },
    { refName: 'chr1' },
  ])
  expect(first).toMatchObject({ refName: 'chr2', start: 0, end: 100 })
})
