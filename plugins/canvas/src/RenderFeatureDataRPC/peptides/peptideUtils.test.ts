import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { of } from 'rxjs'

import { mockDisplayConfig } from '../testUtils.ts'
import { fetchPeptideData, processTranscriptFromSeq } from './peptideUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: jest.fn(),
}))

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

describe('processTranscriptFromSeq', () => {
  const seq = 'ATGAAA'

  it('translates a forward-strand CDS', () => {
    const transcript = createCoordFeature({
      type: 'mRNA',
      start: 0,
      end: 6,
      strand: 1,
      subfeatures: [createCoordFeature({ type: 'CDS', start: 0, end: 6 })],
    })
    expect(processTranscriptFromSeq(seq, transcript)?.protein).toBe('MK')
  })

  it('translates a standalone polyprotein CDS from its own span', () => {
    // The CDS owns mature_protein_region children rather than CDS segments, so
    // the coding sequence is its own extent.
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
    expect(processTranscriptFromSeq(seq, cds)?.protein).toBe('MK')
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
    // Without the dedup the duplicate row stitches to ATGAAAATGAAA -> MKMK.
    expect(processTranscriptFromSeq(seq, transcript)?.protein).toBe('MK')
  })

  // TGA codes Trp rather than stop under the vertebrate mitochondrial code.
  it('honors an alternative genetic code (vertebrate mitochondrial)', () => {
    const mitoSeq = 'ATGTGAAAA'
    const transcript = createCoordFeature({
      type: 'mRNA',
      start: 0,
      end: 9,
      strand: 1,
      subfeatures: [createCoordFeature({ type: 'CDS', start: 0, end: 9 })],
    })
    expect(processTranscriptFromSeq(mitoSeq, transcript)?.protein).toBe('M*K')
    expect(processTranscriptFromSeq(mitoSeq, transcript, 2)?.protein).toBe(
      'MWK',
    )
  })

  it('applies transl_except from the CDS (selenocysteine readthrough)', () => {
    // ATG TGA AAA is M * K under the standard code; the transl_except rewrites
    // the TGA codon at genomic 3..6 as selenocysteine.
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
    const result = processTranscriptFromSeq(seleno, transcript)
    expect(result?.protein).toBe('MUK')
    expect([...(result?.translExceptIndices ?? [])]).toEqual([1])
  })
})

describe('fetchPeptideData', () => {
  const CONTIG_LENGTH = 250_000

  // Real bases only at the coding positions; everywhere else is one that would
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

  // Records what the sequence adapter was actually asked for. Ranges are fetched
  // concurrently, so callers compare against this sorted.
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
      mockDisplayConfig(),
    )
    return map.get(transcript.id())?.protein
  }

  beforeEach(() => {
    jest.mocked(getFeatureAdapterOrThrow).mockReset()
  })

  it('fetches the coding stretches rather than the whole transcript span', async () => {
    // ATGAAA + TTTGGG -> MKFG, split across an 8.9kb intron.
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
    // merge threshold, so the cap has to close some of those gaps anyway.
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
