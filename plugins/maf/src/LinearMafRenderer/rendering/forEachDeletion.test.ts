import { forEachDeletion } from './forEachDeletion.ts'

const enc = new TextEncoder()
const b = (s: string) => enc.encode(s)

function runs(ref: string, aln: string, startBp = 100) {
  const out: { start: number; length: number }[] = []
  forEachDeletion(b(ref), b(aln), startBp, (start, length) => {
    out.push({ start, length })
  })
  return out
}

test('emits one run for a contiguous gap at reference-base columns', () => {
  // ref AAAA, sample a--g → 2bp deletion at genomic 101
  expect(runs('AAAA', 'a--g')).toEqual([{ start: 101, length: 2 }])
})

test('no deletion when the sample has no gaps', () => {
  expect(runs('ACGT', 'acgt')).toEqual([])
})

test('reference-gap (insertion) columns consume no coordinate and split runs', () => {
  // the ref `-` column is an insertion column; the two flanking A's are still
  // genomically adjacent, but the insertion column breaks the deletion run
  expect(runs('A-AA', 'a-c-')).toEqual([{ start: 102, length: 1 }])
})

test('a space (missing data) is not a deletion', () => {
  expect(runs('AAA', 'a a')).toEqual([])
})

test('multiple separate deletions in one row', () => {
  // ref AAAAA, sample a-a-a → two 1bp deletions at 101 and 103
  expect(runs('AAAAA', 'a-a-a')).toEqual([
    { start: 101, length: 1 },
    { start: 103, length: 1 },
  ])
})
