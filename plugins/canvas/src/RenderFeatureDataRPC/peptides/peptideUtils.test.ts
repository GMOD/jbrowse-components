import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'

import {
  findTranscriptsWithCDS,
  processTranscriptFromSeq,
  transcriptGeneticCodeId,
} from './peptideUtils.ts'

import type { Feature } from '@jbrowse/core/util'

const standardCode = getGeneticCode(1)
const vertebrateMitoCode = getGeneticCode(2)

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

describe('findTranscriptsWithCDS', () => {
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
    const result = findTranscriptsWithCDS(features)

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
    const result = findTranscriptsWithCDS(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('gene-1')
  })

  it('prefers mRNA children over direct CDS children', () => {
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
    const result = findTranscriptsWithCDS(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('mRNA-1')
  })

  it('finds standalone transcript with CDS', () => {
    const transcript = createMockFeature({
      id: 'transcript-1',
      type: 'transcript',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })

    const features = new Map([['transcript-1', transcript]])
    const result = findTranscriptsWithCDS(features)

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
    const result = findTranscriptsWithCDS(features)

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
    const result = findTranscriptsWithCDS(features)

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
    const result = findTranscriptsWithCDS(features)

    expect(result).toHaveLength(0)
  })

  it('handles gene with no subfeatures', () => {
    const gene = createMockFeature({
      id: 'gene-1',
      type: 'gene',
      subfeatures: [],
    })

    const features = new Map([['gene-1', gene]])
    const result = findTranscriptsWithCDS(features)

    expect(result).toHaveLength(0)
  })

  it('handles primary_transcript type', () => {
    const transcript = createMockFeature({
      id: 'transcript-1',
      type: 'primary_transcript',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })

    const features = new Map([['transcript-1', transcript]])
    const result = findTranscriptsWithCDS(features)

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
    const result = findTranscriptsWithCDS(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('transcript-1')
  })

  it('finds a coding transcript of any type name without configuration', () => {
    // structural: a direct CDS child makes this a coding transcript regardless
    // of whether its type is in any configured list
    const transcript = createMockFeature({
      id: 'transcript-1',
      type: 'some_org_specific_transcript',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })

    const features = new Map([['transcript-1', transcript]])
    const result = findTranscriptsWithCDS(features)

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
    const result = findTranscriptsWithCDS(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('mRNA-1')
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
    const result = findTranscriptsWithCDS(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('mRNA-1')
  })
})

function createCoordFeature(opts: {
  type?: string
  start: number
  end: number
  phase?: number
  strand?: number
  transl_except?: string
  subfeatures?: Feature[]
}): Feature {
  const data: Record<string, unknown> = { ...opts }
  return {
    get: (key: string) => data[key],
    id: () => 'transcript-1',
  } as unknown as Feature
}

describe('transcriptGeneticCodeId', () => {
  it('reads transl_table off the CDS subfeature', () => {
    const transcript = createMockFeature({
      type: 'mRNA',
      subfeatures: [createMockFeature({ type: 'CDS', transl_table: 2 })],
    })
    expect(transcriptGeneticCodeId(transcript, undefined)).toBe(2)
  })

  it('prefers the transcript transl_table over the CDS', () => {
    const transcript = createMockFeature({
      type: 'mRNA',
      transl_table: 5,
      subfeatures: [createMockFeature({ type: 'CDS', transl_table: 2 })],
    })
    expect(transcriptGeneticCodeId(transcript, undefined)).toBe(5)
  })

  it('falls back to the assembly genetic code when no transl_table is present', () => {
    const transcript = createMockFeature({
      type: 'mRNA',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })
    expect(transcriptGeneticCodeId(transcript, 2)).toBe(2)
  })

  it('prefers a feature transl_table over the assembly genetic code', () => {
    const transcript = createMockFeature({
      type: 'mRNA',
      subfeatures: [createMockFeature({ type: 'CDS', transl_table: 3 })],
    })
    expect(transcriptGeneticCodeId(transcript, 2)).toBe(3)
  })

  it('is undefined (standard code) when neither source provides one', () => {
    const transcript = createMockFeature({
      type: 'mRNA',
      subfeatures: [createMockFeature({ type: 'CDS' })],
    })
    expect(transcriptGeneticCodeId(transcript, undefined)).toBeUndefined()
  })
})

describe('processTranscriptFromSeq', () => {
  // ATG=M, AAA=K
  const seq = 'ATGAAA'

  it('translates a forward-strand CDS', () => {
    const transcript = createCoordFeature({
      type: 'mRNA',
      start: 0,
      end: 6,
      strand: 1,
      subfeatures: [createCoordFeature({ type: 'CDS', start: 0, end: 6 })],
    })
    expect(
      processTranscriptFromSeq(seq, transcript, standardCode)?.protein,
    ).toBe('MK')
  })

  it('dedupes duplicate CDS rows so the protein is not frameshifted', () => {
    const transcript = createCoordFeature({
      type: 'mRNA',
      start: 0,
      end: 6,
      strand: 1,
      subfeatures: [
        createCoordFeature({ type: 'CDS', start: 0, end: 6 }),
        createCoordFeature({ type: 'CDS', start: 0, end: 6 }),
      ],
    })
    // without dedup the duplicate row would stitch to ATGAAAATGAAA -> MKMK
    expect(
      processTranscriptFromSeq(seq, transcript, standardCode)?.protein,
    ).toBe('MK')
  })

  // TGA codes Trp (not stop) under the vertebrate mitochondrial code, so the
  // same sequence translates differently depending on the table passed in
  it('honors an alternative genetic code (vertebrate mitochondrial)', () => {
    // ATG TGA AAA: M, (TGA), K
    const mitoSeq = 'ATGTGAAAA'
    const transcript = createCoordFeature({
      type: 'mRNA',
      start: 0,
      end: 9,
      strand: 1,
      subfeatures: [createCoordFeature({ type: 'CDS', start: 0, end: 9 })],
    })
    expect(
      processTranscriptFromSeq(mitoSeq, transcript, standardCode)?.protein,
    ).toBe('M*K')
    expect(
      processTranscriptFromSeq(mitoSeq, transcript, vertebrateMitoCode)
        ?.protein,
    ).toBe('MWK')
  })

  // matches the feature-detail protein view: a transl_except on the CDS rewrites
  // the readthrough stop, so the in-track overlay shows U rather than *
  it('applies transl_except from the CDS (selenocysteine readthrough)', () => {
    // ATG TGA AAA -> M * K under the standard code; transl_except rewrites the
    // TGA codon (genomic 3..6) as selenocysteine
    const seleno = 'ATGTGAAAA'
    const transcript = createCoordFeature({
      type: 'mRNA',
      start: 0,
      end: 9,
      strand: 1,
      subfeatures: [
        createCoordFeature({
          type: 'CDS',
          start: 0,
          end: 9,
          transl_except: '(pos:4..6,aa:Sec)',
        }),
      ],
    })
    const result = processTranscriptFromSeq(seleno, transcript, standardCode)
    expect(result?.protein).toBe('MUK')
    // codon index 1 (the TGA->U) is reported so the overlay can highlight it
    expect([...(result?.translExceptIndices ?? [])]).toEqual([1])
  })
})
