import { cellCarriesAlt } from './variantCellStyles.ts'

// The matrix tooltip's "Insertion: Nbp" row is gated on this, and the regular
// display gates the same readout on the painter's per-cell `cellAltDosage` —
// so the two have to agree about which haplotype row of `1|0` carries the
// inserted sequence.
test('a haplotype row carries only its own allele', () => {
  expect(cellCarriesAlt('1|0', 0)).toBe(true)
  expect(cellCarriesAlt('1|0', 1)).toBe(false)
  expect(cellCarriesAlt('0|1', 0)).toBe(false)
  expect(cellCarriesAlt('0|1', 1)).toBe(true)
})

// Haploid is phased (pangenome callsets write bare `1`), and a sample with
// fewer alleles than the row count has nothing on the rows it doesn't reach.
test('haploid and mixed ploidy', () => {
  expect(cellCarriesAlt('1', 0)).toBe(true)
  expect(cellCarriesAlt('1', 1)).toBe(false)
  expect(cellCarriesAlt('23', 0)).toBe(true)
})

// Both paint the same cell on every haplotype row, and neither is an alt.
test('unphased and no-call carry nothing on any haplotype row', () => {
  expect(cellCarriesAlt('0/1', 0)).toBe(false)
  expect(cellCarriesAlt('0/1', 1)).toBe(false)
  expect(cellCarriesAlt('.|1', 0)).toBe(false)
  expect(cellCarriesAlt('./.', 0)).toBe(false)
})

// Allele-count mode has no haplotype rows: the row is the whole sample, so a
// het carries the alt the same way a hom does.
test('without a haplotype the sample answers', () => {
  expect(cellCarriesAlt('1|0', undefined)).toBe(true)
  expect(cellCarriesAlt('0/1', undefined)).toBe(true)
  expect(cellCarriesAlt('0|0', undefined)).toBe(false)
  expect(cellCarriesAlt('./.', undefined)).toBe(false)
  expect(cellCarriesAlt('0/10', undefined)).toBe(true)
})
