import { buildVariantHit, buildVariantLaneHit } from './buildVariantHit.ts'
import { getTooltipRows } from './components/getTooltipRows.ts'

import type { VariantFeatureInfo } from './types.ts'

// A monomorphic record spells its ALT column '.', which @gmod/vcf parses to
// `undefined` rather than a list. Such a site still ships: it has called alleles
// (all reference), so the filter chokepoint keeps it, and a reference cell is
// drawn for it — always in the matrix, and in the regular display whenever "Show
// reference alleles" is on. Hovering that cell used to throw on `info.alt.length`,
// so `VariantFeatureInfo.alt` has to be normalized to `[]` by the producers.
test('a site with no ALT alleles builds a tooltip instead of throwing', () => {
  const info: VariantFeatureInfo = {
    ref: 'A',
    alt: [],
    name: 'mono1',
    description: 'no alternative alleles',
    length: 1,
    insertedBp: 0,
    type: 'remark',
    genotypeCodes: new Uint32Array(),
  }
  const fields = buildVariantHit({
    info,
    genotype: '0|0',
    sampleName: 'HG001',
    name: 'HG001',
    featureId: 'mono1',
  })
  expect(fields.description).toBe('no alternative alleles')
  expect(fields.alleles).toBe('ref(A)|ref(A)')
})

// The variant lane's marks are records, so its hit names no sample. The three
// sample fields are empty rather than absent precisely so one hover slot serves
// both bands: `getTooltipRows` drops an empty value, so what the reader sees is
// the record's rows alone.
describe('a variant-lane hit', () => {
  const info: VariantFeatureInfo = {
    ref: 'A',
    alt: ['T', 'G'],
    name: 'rs123',
    description: 'SNV',
    length: 1,
    insertedBp: 0,
    type: 'SNV',
    genotypeCodes: new Uint32Array(),
  }

  test('reports the records own alleles, with no genotype or sample rows', () => {
    const rows = getTooltipRows(buildVariantLaneHit({ info, featureId: 'v0' }))
    expect(rows).toEqual([
      { key: 'featureName', label: 'Name', value: 'rs123' },
      { key: 'alleles', label: 'Alleles', value: 'A > T,G' },
      { key: 'length', label: 'Length', value: '1bp' },
      { key: 'description', label: 'Description', value: 'SNV' },
    ])
  })

  test('names no sample row, which is what leaves the metadata merge nothing to find', () => {
    expect(buildVariantLaneHit({ info, featureId: 'v0' }).name).toBe('')
  })

  test('spells out multiple ALTs where a genotype hover summarizes them', () => {
    const threeAlts = { ...info, alt: ['T', 'G', 'C'] }
    expect(
      buildVariantLaneHit({ info: threeAlts, featureId: 'v0' }),
    ).toMatchObject({ alleles: 'A > T,G,C', description: 'SNV' })
    expect(
      buildVariantHit({
        info: threeAlts,
        genotype: '0|1',
        sampleName: 'HG001',
        name: 'HG001',
        featureId: 'v0',
      }).description,
    ).toBe('multiple ALT alleles')
  })

  test('an insertion reports the bp its marker counts', () => {
    const ins = { ...info, insertedBp: 42 }
    expect(buildVariantLaneHit({ info: ins, featureId: 'v0' }).insertion).toBe(
      '42bp',
    )
  })
})
