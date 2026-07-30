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
  // the middle ref `-` is an insertion column carrying sample sequence, so the
  // two flanking deleted bases (genomically adjacent at 101/102) are two runs
  expect(runs('AA-AA', 'a-x-a')).toEqual([
    { start: 101, length: 1 },
    { start: 102, length: 1 },
  ])
})

test('a space (missing data) is not a deletion', () => {
  expect(runs('AAA', 'a a')).toEqual([])
})

test('a run truncated by the end of the block is not a deletion', () => {
  // the sample's alignment stops mid-block; the trailing gap's length measures
  // where the MAF was chunked, not a deletion (the "525" case)
  expect(runs('AAAA', 'aa--')).toEqual([])
})

test('a run truncated by the start of the block is not a deletion', () => {
  // the mirror case, a gap leading into the block (the "460" case)
  expect(runs('AAAA', '--aa')).toEqual([])
})

test('a row that is gaps end to end emits nothing', () => {
  expect(runs('AAAA', '----')).toEqual([])
})

test('a deletion flanked by sample sequence survives at either block edge', () => {
  // one base of flank on each side is enough — the block boundary is only
  // suspect when the gap actually reaches it
  expect(runs('AAAA', 'a--a')).toEqual([{ start: 101, length: 2 }])
})

test('multiple separate deletions in one row', () => {
  // ref AAAAA, sample a-a-a → two 1bp deletions at 101 and 103
  expect(runs('AAAAA', 'a-a-a')).toEqual([
    { start: 101, length: 1 },
    { start: 103, length: 1 },
  ])
})
