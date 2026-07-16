import {
  featureHasCDS,
  featureHasExon,
  featureHasExonOrCDS,
  getTranscripts,
  pickDefaultTranscriptIndex,
  resolveShowCoordinates,
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

describe('resolveShowCoordinates', () => {
  test('genomic survives in contiguous genome-based modes', () => {
    expect(resolveShowCoordinates('genomic', 'gene')).toBe('genomic')
    expect(resolveShowCoordinates('genomic', 'gene_updownstream')).toBe(
      'genomic',
    )
    expect(resolveShowCoordinates('genomic', 'genomic')).toBe('genomic')
    expect(
      resolveShowCoordinates('genomic', 'genomic_sequence_updownstream'),
    ).toBe('genomic')
  })

  test('a sticky genomic setting falls back to relative in spliced/collapsed modes', () => {
    // these modes render relative coordinates, so reporting 'genomic' would
    // leave the menu radio group with nothing checked
    expect(resolveShowCoordinates('genomic', 'cdna')).toBe('relative')
    expect(resolveShowCoordinates('genomic', 'cds')).toBe('relative')
    expect(resolveShowCoordinates('genomic', 'protein')).toBe('relative')
    expect(resolveShowCoordinates('genomic', 'gene_collapsed_intron')).toBe(
      'relative',
    )
    expect(
      resolveShowCoordinates('genomic', 'gene_updownstream_collapsed_intron'),
    ).toBe('relative')
  })

  test('none and relative pass through unchanged in every mode', () => {
    expect(resolveShowCoordinates('none', 'cdna')).toBe('none')
    expect(resolveShowCoordinates('none', 'gene')).toBe('none')
    expect(resolveShowCoordinates('relative', 'cdna')).toBe('relative')
    expect(resolveShowCoordinates('relative', 'gene')).toBe('relative')
  })
})
