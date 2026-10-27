import { mockDisplayConfig } from '../testUtils.ts'
import { peptideTargets } from './findGlyph.ts'

import type { MockDisplayConfigOverrides } from '../testUtils.ts'
import type { Feature } from '@jbrowse/core/util'

function createMockFeature(opts: {
  id?: string
  type?: string
  transl_table?: number
  subfeatures?: Feature[]
}): Feature {
  const data: Record<string, unknown> = {
    type: opts.type,
    transl_table: opts.transl_table,
    subfeatures: opts.subfeatures,
  }
  return {
    get: (key: string) => data[key],
    id: () => opts.id ?? 'mock-id',
  } as unknown as Feature
}

function targets(
  features: Map<string, Feature>,
  config: MockDisplayConfigOverrides = {},
) {
  return [...features.values()].flatMap(f =>
    peptideTargets(f, mockDisplayConfig(config)),
  )
}

describe('peptideTargets', () => {
  it('finds transcripts in gene->mRNA->CDS hierarchy', () => {
    const mRNA = createMockFeature({
      id: 'mRNA-1',
      type: 'mRNA',
      subfeatures: [
        createMockFeature({ type: 'exon' }),
        createMockFeature({ type: 'CDS' }),
      ],
    })
    const gene = createMockFeature({
      id: 'gene-1',
      type: 'gene',
      subfeatures: [mRNA],
    })

    const features = new Map([['gene-1', gene]])
    const result = targets(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('mRNA-1')
  })

  it('finds gene with direct CDS children (gene->CDS hierarchy)', () => {
    const gene = createMockFeature({
      id: 'gene-1',
      type: 'gene',
      subfeatures: [
        createMockFeature({ type: 'CDS' }),
        createMockFeature({ type: 'CDS' }),
      ],
    })

    const features = new Map([['gene-1', gene]])
    const result = targets(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('gene-1')
  })

  it('translates a CDS box beside an mRNA as well as the mRNA', () => {
    const mRNA = createMockFeature({
      id: 'mRNA-1',
      type: 'mRNA',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })
    const gene = createMockFeature({
      id: 'gene-1',
      type: 'gene',
      subfeatures: [mRNA, createMockFeature({ type: 'CDS' })],
    })

    const features = new Map([['gene-1', gene]])
    const result = targets(features)

    expect(result.map(f => f.id())).toEqual(['mRNA-1', 'mock-id'])
  })

  it('finds standalone transcript with CDS', () => {
    const transcript = createMockFeature({
      id: 'transcript-1',
      type: 'transcript',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })

    const features = new Map([['transcript-1', transcript]])
    const result = targets(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('transcript-1')
  })

  it('finds multiple transcripts from gene with multiple mRNAs', () => {
    const mRNA1 = createMockFeature({
      id: 'mRNA-1',
      type: 'mRNA',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })
    const mRNA2 = createMockFeature({
      id: 'mRNA-2',
      type: 'mRNA',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })
    const gene = createMockFeature({
      id: 'gene-1',
      type: 'gene',
      subfeatures: [mRNA1, mRNA2],
    })

    const features = new Map([['gene-1', gene]])
    const result = targets(features)

    expect(result).toHaveLength(2)
    expect(result.map(r => r.id())).toEqual(['mRNA-1', 'mRNA-2'])
  })

  it('ignores gene without CDS in any form', () => {
    const gene = createMockFeature({
      id: 'gene-1',
      type: 'gene',
      subfeatures: [
        createMockFeature({ type: 'exon' }),
        createMockFeature({ type: 'exon' }),
      ],
    })

    const features = new Map([['gene-1', gene]])
    const result = targets(features)

    expect(result).toHaveLength(0)
  })

  it('ignores mRNA without CDS children', () => {
    const mRNA = createMockFeature({
      id: 'mRNA-1',
      type: 'mRNA',
      subfeatures: [createMockFeature({ type: 'exon' })],
    })
    const gene = createMockFeature({
      id: 'gene-1',
      type: 'gene',
      subfeatures: [mRNA],
    })

    const features = new Map([['gene-1', gene]])
    const result = targets(features)

    expect(result).toHaveLength(0)
  })

  it('handles gene with no subfeatures', () => {
    const gene = createMockFeature({
      id: 'gene-1',
      type: 'gene',
      subfeatures: [],
    })

    const features = new Map([['gene-1', gene]])
    const result = targets(features)

    expect(result).toHaveLength(0)
  })

  it('handles primary_transcript type', () => {
    const transcript = createMockFeature({
      id: 'transcript-1',
      type: 'primary_transcript',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })

    const features = new Map([['transcript-1', transcript]])
    const result = targets(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('transcript-1')
  })

  it('handles protein_coding_primary_transcript type', () => {
    const transcript = createMockFeature({
      id: 'transcript-1',
      type: 'protein_coding_primary_transcript',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })

    const features = new Map([['transcript-1', transcript]])
    const result = targets(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('transcript-1')
  })

  it('finds a coding transcript of any type name without configuration', () => {
    const transcript = createMockFeature({
      id: 'transcript-1',
      type: 'some_org_specific_transcript',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })

    const features = new Map([['transcript-1', transcript]])
    const result = targets(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('transcript-1')
  })

  it('descends into a non-gene container to reach its transcripts', () => {
    const mRNA = createMockFeature({
      id: 'mRNA-1',
      type: 'mRNA',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })
    const orf = createMockFeature({
      id: 'orf-1',
      type: 'proteoform_orf',
      subfeatures: [mRNA],
    })

    const features = new Map([['orf-1', orf]])
    const result = targets(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('mRNA-1')
  })

  it('finds a standalone polyprotein CDS (mature-protein children, no wrapper)', () => {
    // With no gene/mRNA layer the CDS is itself the coding unit, even though its
    // cleavage-product children are not CDS segments.
    const cds = createMockFeature({
      id: 'cds-1',
      type: 'CDS',
      subfeatures: [
        createMockFeature({ type: 'mature_protein_region_of_CDS' }),
        createMockFeature({ type: 'mature_protein_region_of_CDS' }),
      ],
    })

    const features = new Map([['cds-1', cds]])
    const result = targets(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('cds-1')
  })

  // SARS-CoV-2's ORF1ab gene owns pp1ab (266..21555) and the overlapping pp1a
  // (266..13483), each with its own cleavage products, so keying translation at
  // the gene stitches both spans into one impossible ORF.
  it('translates each polyprotein CDS of a multi-CDS gene separately', () => {
    const polyprotein = (id: string) =>
      createMockFeature({
        id,
        type: 'CDS',
        subfeatures: [
          createMockFeature({ type: 'mature_protein_region_of_CDS' }),
        ],
      })
    const gene = createMockFeature({
      id: 'gene-ORF1ab',
      type: 'gene',
      subfeatures: [polyprotein('cds-pp1ab'), polyprotein('cds-pp1a')],
    })

    const result = targets(new Map([['gene-ORF1ab', gene]]))

    expect(result.map(f => f.id())).toEqual(['cds-pp1ab', 'cds-pp1a'])
  })

  // The same polyprotein one level deeper, as a GenBank flatfile conversion
  // emits it. The mRNA satisfies hasCDSSubfeature, so translating it instead
  // leaves the emitter's per-CDS peptide lookup empty.
  it('reaches a polyprotein CDS nested under an mRNA', () => {
    const cds = createMockFeature({
      id: 'cds-1',
      type: 'CDS',
      subfeatures: [createMockFeature({ type: 'mat_peptide' })],
    })
    const mRNA = createMockFeature({
      id: 'mRNA-1',
      type: 'mRNA',
      subfeatures: [cds],
    })
    const gene = createMockFeature({
      id: 'gene-1',
      type: 'gene',
      subfeatures: [mRNA],
    })

    const result = targets(new Map([['gene-1', gene]]))

    expect(result.map(f => f.id())).toEqual(['cds-1'])
  })

  it('translates a bare top-level CDS as its own coding unit', () => {
    const cds = createMockFeature({ id: 'cds-1', type: 'CDS', subfeatures: [] })

    const features = new Map([['cds-1', cds]])
    const result = targets(features)

    expect(result.map(f => f.id())).toEqual(['cds-1'])
  })

  it('descends into a structural container (children are containers) for a custom type', () => {
    const mRNA = createMockFeature({
      id: 'mRNA-1',
      type: 'mRNA',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })
    const geneLike = createMockFeature({
      id: 'gene-like-1',
      type: 'ncRNA_gene',
      subfeatures: [mRNA],
    })

    const features = new Map([['gene-like-1', geneLike]])
    const result = targets(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('mRNA-1')
  })

  it('translates each CDS box of a container type with direct CDS children', () => {
    const orf = createMockFeature({
      id: 'orf-1',
      type: 'proteoform_orf',
      subfeatures: [
        createMockFeature({ id: 'cds-1', type: 'CDS' }),
        createMockFeature({ id: 'cds-2', type: 'CDS' }),
      ],
    })

    const result = targets(new Map([['orf-1', orf]]), {
      containerTypes: ['proteoform_orf'],
    })

    expect(result.map(f => f.id())).toEqual(['cds-1', 'cds-2'])
  })

  it('translates a plain CDS beside a polyprotein CDS', () => {
    const polyprotein = createMockFeature({
      id: 'cds-pp',
      type: 'CDS',
      subfeatures: [createMockFeature({ type: 'mat_peptide' })],
    })
    const gene = createMockFeature({
      id: 'gene-1',
      type: 'gene',
      subfeatures: [
        polyprotein,
        createMockFeature({ id: 'cds-plain', type: 'CDS' }),
      ],
    })

    const result = targets(new Map([['gene-1', gene]]))

    expect(result.map(f => f.id())).toEqual(['cds-pp', 'cds-plain'])
  })
})
