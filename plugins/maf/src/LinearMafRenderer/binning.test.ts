import { buildColumnForGenomicOffset } from './binning.ts'

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
