import SimpleFeature from './simpleFeature.ts'
import {
  transcriptCDS,
  transcriptGeneticCodeId,
  translateTranscript,
} from './translateTranscript.ts'

function transcript({
  strand = 1,
  cds = [{ start: 0, end: 15 }],
  attributes = {},
  cdsAttributes = {},
}: {
  strand?: number
  cds?: { start: number; end: number; phase?: number }[]
  attributes?: Record<string, unknown>
  cdsAttributes?: Record<string, unknown>
} = {}) {
  return new SimpleFeature({
    uniqueId: 't1',
    refName: 'chr1',
    start: 0,
    end: 15,
    strand,
    type: 'mRNA',
    ...attributes,
    subfeatures: cds.map((c, i) => ({
      uniqueId: `t1-cds${i}`,
      refName: 'chr1',
      strand,
      type: 'CDS',
      phase: 0,
      ...c,
      ...cdsAttributes,
    })),
  })
}

describe('transcriptGeneticCodeId', () => {
  test('reads transl_table off the CDS', () => {
    expect(
      transcriptGeneticCodeId(
        transcript({ cdsAttributes: { transl_table: 2 } }),
      ),
    ).toBe(2)
  })

  test('prefers the transcript transl_table over the CDS', () => {
    expect(
      transcriptGeneticCodeId(
        transcript({
          attributes: { transl_table: 5 },
          cdsAttributes: { transl_table: 2 },
        }),
      ),
    ).toBe(5)
  })

  test('falls back to the assembly code, then to the standard code', () => {
    expect(transcriptGeneticCodeId(transcript(), 2)).toBe(2)
    expect(
      transcriptGeneticCodeId(
        transcript({ cdsAttributes: { transl_table: 3 } }),
        2,
      ),
    ).toBe(3)
    expect(transcriptGeneticCodeId(transcript())).toBeUndefined()
  })
})

describe('transcriptCDS', () => {
  test('sorts and drops repeated CDS rows', () => {
    const t = transcript({
      cds: [
        { start: 9, end: 15 },
        { start: 0, end: 6 },
        { start: 0, end: 6 },
      ],
    })
    expect(transcriptCDS(t).map(c => [c.start, c.end])).toEqual([
      [0, 6],
      [9, 15],
    ])
  })
})

describe('translateTranscript', () => {
  test('reads an alternative initiator as M under its code', () => {
    const seq = 'GTGAAAAAAAAATAA'
    expect(
      translateTranscript({ transcript: transcript(), seq })?.protein,
    ).toBe('VKKK*')
    expect(
      translateTranscript({
        transcript: transcript(),
        seq,
        assemblyGeneticCodeId: 11,
      })?.protein,
    ).toBe('MKKK*')
  })

  test('reads a selenocysteine transl_except as U', () => {
    const result = translateTranscript({
      transcript: transcript({
        cdsAttributes: { transl_except: '(pos:4..6,aa:Sec)' },
      }),
      seq: 'ATGTGAAAAAAATAA',
    })
    expect(result?.protein).toBe('MUKK*')
    expect(result?.translExcept).toEqual([{ start: 3, end: 6, aa: 'U' }])
  })

  test('places a minus-strand transl_except on the reverse-complemented codon', () => {
    // ATGTGAAAAAAATAA read backwards off the genome
    const seq = 'TTATTTTTTTCACAT'
    const minus = (transl_except: string) =>
      translateTranscript({
        transcript: transcript({
          strand: -1,
          cdsAttributes: { transl_except },
        }),
        seq,
      })?.protein
    expect(minus('(pos:complement(10..12),aa:Sec)')).toBe('MUKK*')
    expect(minus('(pos:complement(4..6),aa:Sec)')).toBe('M*KU*')
  })

  test('is undefined for a transcript with no CDS', () => {
    expect(
      translateTranscript({ transcript: transcript({ cds: [] }), seq: 'ATG' }),
    ).toBeUndefined()
  })
})
