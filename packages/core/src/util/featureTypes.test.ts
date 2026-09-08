import { isGeneLikeType, isSequenceMatchType } from './featureTypes.ts'

describe('isGeneLikeType', () => {
  it.each([
    'gene',
    'protein_coding_gene',
    'pseudogene',
    'ncRNA_gene',
    'V_gene_segment',
    'mRNA',
    'lnc_RNA',
    'tRNA',
    'transcript',
    'pseudogenic_transcript',
  ])('accepts %s', type => {
    expect(isGeneLikeType(type)).toBe(true)
  })

  it.each([
    'intergenic_region',
    'exon',
    'CDS',
    'mature_protein_region_of_CDS',
    'repeat_region',
    'match',
    'cDNA_match',
    undefined,
  ])('refuses %s', type => {
    expect(isGeneLikeType(type)).toBe(false)
  })
})

describe('isSequenceMatchType', () => {
  it.each([
    'match',
    'cDNA_match',
    'EST_match',
    'nucleotide_match',
    'protein_match',
    'translated_nucleotide_match',
    'expressed_sequence_match',
  ])('accepts %s', type => {
    expect(isSequenceMatchType(type)).toBe(true)
  })

  it.each(['match_part', 'mismatch', 'gene', 'mRNA', 'exon', undefined])(
    'refuses %s',
    type => {
      expect(isSequenceMatchType(type)).toBe(false)
    },
  )
})
