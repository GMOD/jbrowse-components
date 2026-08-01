import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'
import { of } from 'rxjs'

import {
  fetchPeptideData,
  findTranscriptsWithCDS,
  processTranscriptFromSeq,
  transcriptGeneticCodeId,
} from './peptideUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: jest.fn(),
}))

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

  it('finds a standalone polyprotein CDS (mature-protein children, no wrapper)', () => {
    // a bare CDS -> mature_protein_region GFF with no gene/mRNA layer: the CDS
    // is itself the coding unit, so it must be translated even though its
    // cleavage-product children are not CDS segments
    const cds = createMockFeature({
      id: 'cds-1',
      type: 'CDS',
      subfeatures: [
        createMockFeature({ type: 'mature_protein_region_of_CDS' }),
        createMockFeature({ type: 'mature_protein_region_of_CDS' }),
      ],
    })

    const features = new Map([['cds-1', cds]])
    const result = findTranscriptsWithCDS(features)

    expect(result).toHaveLength(1)
    expect(result[0]!.id()).toBe('cds-1')
  })

  // test_data/sars-cov2/ncbi_original.gff3: the ORF1ab gene owns pp1ab
  // (266..21555) and the overlapping pp1a (266..13483), each with its own
  // cleavage products. Keying translation at the gene stitched both CDS spans
  // into one 11502-aa ORF in place of the real 7096-aa protein, and every mature
  // region in the shared span then drew residues from both.
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

    const result = findTranscriptsWithCDS(new Map([['gene-ORF1ab', gene]]))

    expect(result.map(f => f.id())).toEqual(['cds-pp1ab', 'cds-pp1a'])
  })

  // The same polyprotein one level deeper, as a GenBank flatfile conversion
  // emits it. The mRNA satisfies hasCDSSubfeature, so it used to be translated
  // instead — leaving the emitter's per-CDS peptide lookup empty.
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

    const result = findTranscriptsWithCDS(new Map([['gene-1', gene]]))

    expect(result.map(f => f.id())).toEqual(['cds-1'])
  })

  it('ignores a bare CDS with no children', () => {
    const cds = createMockFeature({ id: 'cds-1', type: 'CDS', subfeatures: [] })

    const features = new Map([['cds-1', cds]])
    const result = findTranscriptsWithCDS(features)

    expect(result).toHaveLength(0)
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

  it('translates a standalone polyprotein CDS from its own span', () => {
    // the CDS owns mature_protein_region children (not CDS segments), so the
    // coding sequence is the CDS feature's own extent
    const cds = createCoordFeature({
      type: 'CDS',
      start: 0,
      end: 6,
      strand: 1,
      subfeatures: [
        createCoordFeature({
          type: 'mature_protein_region_of_CDS',
          start: 0,
          end: 3,
        }),
        createCoordFeature({
          type: 'mature_protein_region_of_CDS',
          start: 3,
          end: 6,
        }),
      ],
    })
    expect(processTranscriptFromSeq(seq, cds, standardCode)?.protein).toBe('MK')
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

describe('fetchPeptideData', () => {
  const CONTIG_LENGTH = 250_000

  // Bases only at the coding positions; everywhere else is a base that would
  // frameshift the protein if it ever leaked into a codon.
  function makeGenome(codingBases: Map<number, string>) {
    const genome = new Array<string>(CONTIG_LENGTH).fill('C')
    for (const [start, bases] of codingBases) {
      for (let i = 0; i < bases.length; i++) {
        genome[start + i] = bases.charAt(i)
      }
    }
    return genome.join('')
  }

  // Records what the sequence adapter was actually asked for, which is the point
  // of the exercise: the fetched ranges should track the CDS, not the span.
  // ranges are fetched concurrently, so callers compare against this sorted
  function installSequenceAdapter(genome: string, { fail = false } = {}) {
    const requested: { start: number; end: number }[] = []
    jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
      getFeatures: (region: Region) => {
        requested.push({ start: region.start, end: region.end })
        return of({
          get: (key: string) =>
            key === 'seq' && !fail
              ? genome.slice(region.start, region.end)
              : undefined,
        })
      },
    } as unknown as Awaited<ReturnType<typeof getFeatureAdapterOrThrow>>)
    return {
      get sorted() {
        return [...requested].sort((a, b) => a.start - b.start)
      },
    }
  }

  function transcriptWithCDS(exons: { start: number; end: number }[]) {
    const starts = exons.map(e => e.start)
    const ends = exons.map(e => e.end)
    return createCoordFeature({
      type: 'mRNA',
      start: Math.min(...starts),
      end: Math.max(...ends),
      strand: 1,
      subfeatures: exons.map(e =>
        createCoordFeature({ type: 'CDS', start: e.start, end: e.end }),
      ),
    })
  }

  async function translate(transcript: Feature) {
    const map = await fetchPeptideData(
      {} as PluginManager,
      {
        sessionId: 'test',
        sequenceAdapter: { type: 'IndexedFastaAdapter' },
        regions: [
          {
            refName: 'chr1',
            start: 0,
            end: CONTIG_LENGTH,
            assemblyName: 'volvox',
          },
        ],
      },
      new Map([['t1', transcript]]),
    )
    return map.get(transcript.id())?.protein
  }

  beforeEach(() => {
    jest.mocked(getFeatureAdapterOrThrow).mockReset()
  })

  it('fetches the coding stretches rather than the whole transcript span', async () => {
    // ATGAAA + TTTGGG -> MKFG, split across an 8.9kb intron
    const genome = makeGenome(
      new Map([
        [100, 'ATGAAA'],
        [9000, 'TTTGGG'],
      ]),
    )
    const requested = installSequenceAdapter(genome)
    const protein = await translate(
      transcriptWithCDS([
        { start: 100, end: 106 },
        { start: 9000, end: 9006 },
      ]),
    )

    expect(protein).toBe('MKFG')
    expect(requested.sorted).toEqual([
      { start: 100, end: 106 },
      { start: 9000, end: 9006 },
    ])
  })

  it('reads through an intron too small to be worth a second request', async () => {
    const genome = makeGenome(
      new Map([
        [100, 'ATGAAA'],
        [1000, 'TTTGGG'],
      ]),
    )
    const requested = installSequenceAdapter(genome)
    const protein = await translate(
      transcriptWithCDS([
        { start: 100, end: 106 },
        { start: 1000, end: 1006 },
      ]),
    )

    expect(protein).toBe('MKFG')
    expect(requested.sorted).toEqual([{ start: 100, end: 1006 }])
  })

  it('caps the request count on a many-exon gene without changing the protein', async () => {
    // 20 single-codon exons, each separated by an intron far wider than the
    // merge threshold — the cap has to close some of those gaps anyway
    const exons = Array.from({ length: 20 }, (_, i) => ({
      start: 1000 + i * 10_000,
      end: 1000 + i * 10_000 + 3,
    }))
    const genome = makeGenome(new Map(exons.map(e => [e.start, 'ATG'])))
    const requested = installSequenceAdapter(genome)
    const protein = await translate(transcriptWithCDS(exons))

    expect(protein).toBe('M'.repeat(20))
    expect(requested.sorted.length).toBeLessThanOrEqual(12)
    expect(requested.sorted.length).toBeGreaterThan(1)
  })

  it('yields no peptides when a range fails, rather than translating a hole', async () => {
    const genome = makeGenome(new Map([[100, 'ATGAAA']]))
    installSequenceAdapter(genome, { fail: true })
    expect(await translate(transcriptWithCDS([{ start: 100, end: 106 }]))).toBe(
      undefined,
    )
  })
})
