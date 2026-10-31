import { buildRecordHit, buildVariantHit } from './buildVariantHit.ts'
import { getTooltipRows } from './getTooltipRows.ts'

import type { VariantFeatureInfo } from '../../shared/types.ts'

// A monomorphic record spells its ALT column '.', which @gmod/vcf parses to
// `undefined` rather than a list. Such a site still ships: it has called alleles
// (all reference), so the filter chokepoint keeps it, and a reference cell is
// drawn for it — always in columns, and in the genomic layout whenever "Show
// reference alleles" is on. Hovering that cell used to throw on `info.alt.length`,
// so `VariantFeatureInfo.alt` has to be normalized to `[]` by the producers.
test('a site with no ALT alleles builds a tooltip instead of throwing', () => {
  const info: VariantFeatureInfo = {
    featureId: 'mono1',
    ref: 'A',
    alt: [],
    name: 'mono1',
    description: 'no alternative alleles',
    length: 1,
    insertedBp: 0,
    type: 'remark',
    svType: '',
    svAlleles: [],
    tooltip: '',
    groupKey: '',
    labelName: '',
    labelDescription: '',
    genotypeCodes: new Uint32Array(),
  }
  const fields = buildVariantHit({
    info,
    genotype: '0|0',
    sampleName: 'HG001',
    name: 'HG001',
    featureId: 'mono1',
    insertedBp: 0,
  })
  expect(fields.description).toBe('no alternative alleles')
  expect(fields.alleles).toBe('ref(A)|ref(A)')
})

describe('a genotype hit', () => {
  const info: VariantFeatureInfo = {
    featureId: 'rs123',
    ref: 'A',
    alt: ['T', 'G', 'C'],
    name: 'rs123',
    description: 'SNV',
    length: 1,
    insertedBp: 0,
    type: 'SNV',
    svType: '',
    svAlleles: [],
    tooltip: '',
    groupKey: '',
    labelName: '',
    labelDescription: '',
    genotypeCodes: new Uint32Array(),
  }
  const hit = (over: Partial<VariantFeatureInfo>, insertedBp = 0) =>
    buildVariantHit({
      info: { ...info, ...over },
      genotype: '0|1',
      sampleName: 'HG001',
      name: 'HG001',
      featureId: 'v0',
      insertedBp,
    })

  test('summarizes multiple ALTs, whose colors stop being decodable', () => {
    expect(hit({}).description).toBe('multiple ALT alleles')
  })

  test('names the genotype and the record in the tooltip rows', () => {
    const rows = getTooltipRows(hit({ alt: ['T'] }))
    expect(rows.map(r => r.key)).toEqual(
      expect.arrayContaining(['featureName', 'genotype', 'alleles']),
    )
  })

  test('an insertion reports the bp this cell carries, none for a reference cell', () => {
    expect(hit({ alt: ['T'], insertedBp: 42 }, 42).insertion).toBe('42bp')
    expect(hit({ alt: ['T'], insertedBp: 42 }, 0).insertion).toBe('')
  })
})

describe('a records-band hit', () => {
  const info: VariantFeatureInfo = {
    featureId: 'rs123',
    ref: 'A',
    alt: ['T', 'G', 'C'],
    name: 'rs123',
    description: 'SNV',
    length: 1,
    insertedBp: 42,
    type: 'SNV',
    svType: '',
    svAlleles: [],
    tooltip: '',
    groupKey: '',
    labelName: '',
    labelDescription: '',
    genotypeCodes: new Uint32Array(),
  }

  // the description already spells REF and ALT, and a one-base span says
  // nothing the insertion row does not
  test('reports the record, with no genotype, sample, alleles or 1bp span', () => {
    expect(getTooltipRows(buildRecordHit({ info, featureId: 'v0' }))).toEqual([
      { key: 'featureName', label: 'Name', value: 'rs123' },
      { key: 'insertion', label: 'Insertion', value: '42bp' },
      { key: 'description', label: 'Description', value: 'SNV' },
    ])
  })
  test('an SV record names its class and size, not its alleles', () => {
    const rows = getTooltipRows(
      buildRecordHit({
        info: {
          ...info,
          ref: 'A'.repeat(1926),
          alt: ['A'],
          svType: 'DEL',
          description: '<DEL> 1.93Kbp',
          length: 1926,
          insertedBp: 0,
        },
        featureId: 'v0',
      }),
    )
    expect(rows.map(r => r.key)).toEqual([
      'featureName',
      'length',
      'description',
    ])
  })
})
