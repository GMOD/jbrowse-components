import { ColumnMapper, buildColumnForGenomicOffset } from './binning.ts'

const enc = new TextEncoder()
const map = (ref: string) => {
  const { colForGpos, refLen } = buildColumnForGenomicOffset(enc.encode(ref))
  return { cols: [...colForGpos.slice(0, refLen)], refLen }
}

test('with no insertions, offset n is column n', () => {
  expect(map('ACGTA')).toEqual({ cols: [0, 1, 2, 3, 4], refLen: 5 })
})

test('insertion columns are skipped and consume no genomic position', () => {
  // ref `AC--GT`: offsets 0..3 live in columns 0,1,4,5.
  expect(map('AC--GT')).toEqual({ cols: [0, 1, 4, 5], refLen: 4 })
})

test('leading and trailing insertions do not shift the extent', () => {
  expect(map('--AC--')).toEqual({ cols: [2, 3], refLen: 2 })
})

test('an all-insertion reference has zero genomic extent', () => {
  expect(map('----')).toEqual({ cols: [], refLen: 0 })
})

test('empty reference', () => {
  expect(map('')).toEqual({ cols: [], refLen: 0 })
})

// The buffer is reused across the blocks of one pass, so after a wide block it
// stays wider than the next block needs — which is the whole reason `refLen`,
// not the array length, is what both painters walk to. A narrow block following
// a wide one must not see the wide one's tail.
test('a reused mapper leaves stale entries past refLen and none before it', () => {
  const mapper = new ColumnMapper()
  const wide = mapper.build(enc.encode('ACGTACGTAC'))
  expect([...wide.colForGpos.slice(0, wide.refLen)]).toEqual([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  ])
  const narrow = mapper.build(enc.encode('A-C'))
  expect(narrow.refLen).toBe(2)
  expect([...narrow.colForGpos.slice(0, narrow.refLen)]).toEqual([0, 2])
  // same backing store, and it is still the wide block's length
  expect(narrow.colForGpos).toBe(wide.colForGpos)
  expect(narrow.colForGpos.length).toBe(10)
})
