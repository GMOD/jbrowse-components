import { buildVariantHit } from './buildVariantHit.ts'

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
    genotypeCodes: new Uint16Array(),
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
