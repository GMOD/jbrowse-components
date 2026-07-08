import {
  featureHasCDS,
  featureHasExon,
  featureHasExonOrCDS,
  getTranscripts,
  pickDefaultTranscriptIndex,
} from './featureTypeUtil.ts'

describe('hasExonOrCDS', () => {
  test('feature with CDS only is true (no exon subfeatures)', () => {
    const feature = {
      uniqueId: 'a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'mRNA',
      subfeatures: [{ refName: 'chr1', start: 0, end: 100, type: 'CDS' }],
    }
    expect(featureHasCDS(feature)).toBe(true)
    expect(featureHasExon(feature)).toBe(false)
    expect(featureHasExonOrCDS(feature)).toBe(true)
  })

  test('feature with exon only is true', () => {
    const feature = {
      uniqueId: 'a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'mRNA',
      subfeatures: [{ refName: 'chr1', start: 0, end: 100, type: 'exon' }],
    }
    expect(featureHasExon(feature)).toBe(true)
    expect(featureHasExonOrCDS(feature)).toBe(true)
  })

  test('feature with neither is false', () => {
    const feature = {
      uniqueId: 'a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'region',
      subfeatures: [],
    }
    expect(featureHasExonOrCDS(feature)).toBe(false)
  })

  test('mature_protein_region_of_cds counts as CDS', () => {
    const feature = {
      uniqueId: 'a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'mature_protein_region_of_cds',
    }
    expect(featureHasCDS(feature)).toBe(true)
    expect(featureHasExonOrCDS(feature)).toBe(true)
  })
})

describe('getTranscripts/pickDefaultTranscriptIndex', () => {
  test('a gene exposes its mRNA children as transcripts, longest coding span wins', () => {
    const gene = {
      uniqueId: 'gene-a',
      refName: 'chr1',
      start: 0,
      end: 1000,
      type: 'gene',
      subfeatures: [
        {
          refName: 'chr1',
          start: 0,
          end: 400,
          type: 'mRNA',
          name: 'short-isoform',
          subfeatures: [{ refName: 'chr1', start: 0, end: 100, type: 'CDS' }],
        },
        {
          refName: 'chr1',
          start: 0,
          end: 1000,
          type: 'mRNA',
          name: 'long-isoform',
          subfeatures: [{ refName: 'chr1', start: 0, end: 900, type: 'CDS' }],
        },
      ],
    }
    const transcripts = getTranscripts(gene)
    expect(transcripts.map(t => t.name)).toEqual([
      'short-isoform',
      'long-isoform',
    ])
    expect(pickDefaultTranscriptIndex(transcripts)).toBe(1)
  })

  test('prefers a coding transcript over a longer non-coding one', () => {
    const gene = {
      uniqueId: 'gene-b',
      refName: 'chr1',
      start: 0,
      end: 1000,
      type: 'gene',
      subfeatures: [
        {
          refName: 'chr1',
          start: 0,
          end: 900,
          type: 'mRNA',
          name: 'coding-isoform',
          subfeatures: [{ refName: 'chr1', start: 0, end: 100, type: 'CDS' }],
        },
        {
          refName: 'chr1',
          start: 0,
          end: 1000,
          type: 'ncRNA',
          name: 'noncoding-isoform',
          subfeatures: [{ refName: 'chr1', start: 0, end: 1000, type: 'exon' }],
        },
      ],
    }
    const transcripts = getTranscripts(gene)
    expect(pickDefaultTranscriptIndex(transcripts)).toBe(0)
  })

  test('an mRNA has no transcript children of its own', () => {
    const mrna = {
      uniqueId: 'mrna-a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'mRNA',
      subfeatures: [{ refName: 'chr1', start: 0, end: 100, type: 'CDS' }],
    }
    const transcripts = getTranscripts(mrna)
    expect(transcripts).toEqual([])
    expect(pickDefaultTranscriptIndex(transcripts)).toBe(0)
  })
})
