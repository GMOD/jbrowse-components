import { SimpleFeature } from '@jbrowse/core/util'

import {
  getVariantConsequence,
  getVariantImpact,
  getVariantImpactColor,
} from './variantConsequence.ts'

function feat(INFO: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: 'x',
    refName: 'ctgA',
    start: 0,
    end: 1,
    INFO,
  })
}

// SnpEff ANN: Allele|Annotation|Annotation_Impact|...
const snpEff = (ann: string[]) => feat({ ANN: ann })
// VEP CSQ: Allele|Consequence|IMPACT|...
const vep = (csq: string[]) => feat({ CSQ: csq })

describe('variant consequence helpers', () => {
  it('reads consequence/impact from SnpEff ANN', () => {
    const f = snpEff(['A|missense_variant|MODERATE|GENE1|ENSG1'])
    expect(getVariantConsequence(f)).toBe('missense_variant')
    expect(getVariantImpact(f)).toBe('MODERATE')
  })

  it('reads consequence/impact from VEP CSQ', () => {
    const f = vep(['A|stop_gained|HIGH|GENE1|ENSG1'])
    expect(getVariantConsequence(f)).toBe('stop_gained')
    expect(getVariantImpact(f)).toBe('HIGH')
  })

  it('picks the most severe annotation across transcripts', () => {
    const f = snpEff([
      'A|synonymous_variant|LOW|GENE1',
      'A|stop_gained|HIGH|GENE1',
      'A|intron_variant|MODIFIER|GENE2',
    ])
    expect(getVariantImpact(f)).toBe('HIGH')
    expect(getVariantConsequence(f)).toBe('stop_gained')
  })

  it('takes the first of &-joined consequences', () => {
    const f = snpEff([
      'A|missense_variant&splice_region_variant|MODERATE|GENE1',
    ])
    expect(getVariantConsequence(f)).toBe('missense_variant')
  })

  it('finds the impact token regardless of field position', () => {
    // VEP CSQ column order is user-configurable, so IMPACT need not be index 2
    const f = vep(['GENE1|A|ENSG1|missense_variant|MODERATE'])
    expect(getVariantImpact(f)).toBe('MODERATE')
  })

  it('returns empty strings for unannotated variants', () => {
    const f = feat({ AF: [0.5] })
    expect(getVariantConsequence(f)).toBe('')
    expect(getVariantImpact(f)).toBe('')
  })

  it('maps impact tiers to distinct colors', () => {
    const colors = new Set([
      getVariantImpactColor(snpEff(['A|x|HIGH'])),
      getVariantImpactColor(snpEff(['A|x|MODERATE'])),
      getVariantImpactColor(snpEff(['A|x|LOW'])),
      getVariantImpactColor(snpEff(['A|x|MODIFIER'])),
    ])
    expect(colors.size).toBe(4)
  })
})
