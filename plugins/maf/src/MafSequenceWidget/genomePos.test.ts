import { colToHighlight, genomePosAt } from './genomePos.ts'

const region = { refName: 'chr1', assemblyName: 'hg38' }
const colToGenomePos = [100, 101, -1, -1, 102]

test('genomePosAt maps real columns to their genomic position', () => {
  expect(genomePosAt(colToGenomePos, 0)).toBe(100)
  expect(genomePosAt(colToGenomePos, 4)).toBe(102)
})

test('genomePosAt returns undefined for inserted columns (-1 sentinel)', () => {
  expect(genomePosAt(colToGenomePos, 2)).toBeUndefined()
})

test('genomePosAt returns undefined for missing or out-of-range columns', () => {
  expect(genomePosAt(colToGenomePos, undefined)).toBeUndefined()
  expect(genomePosAt(colToGenomePos, 99)).toBeUndefined()
})

test('colToHighlight builds a single-base highlight for a real column', () => {
  expect(colToHighlight(1, colToGenomePos, region)).toEqual({
    refName: 'chr1',
    assemblyName: 'hg38',
    start: 101,
    end: 102,
  })
})

test('colToHighlight returns undefined for inserted columns', () => {
  expect(colToHighlight(2, colToGenomePos, region)).toBeUndefined()
})

test('colToHighlight returns undefined without a region', () => {
  expect(colToHighlight(1, colToGenomePos, undefined)).toBeUndefined()
})
