import {
  featureHasCDS,
  featureHasExon,
  featureHasExonOrCDS,
  getTranscripts,
  pickDefaultTranscriptIndex,
  resolveShowCoordinates,
} from './featureTypeUtil.ts'

import type { CanonicalTranscripts } from '../../util/isoformRank.ts'

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
  test('a gene exposes its mRNA children as transcripts, longest coding wins', () => {
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

describe('pickDefaultTranscriptIndex ranks like the canvas gene glyph', () => {
  function mrna(
    name: string,
    span: [number, number],
    cds: [number, number][],
    extra: Record<string, unknown> = {},
  ) {
    return {
      refName: 'chr1',
      start: span[0],
      end: span[1],
      type: 'mRNA',
      name,
      ...extra,
      subfeatures: cds.map(([start, end]) => ({
        refName: 'chr1',
        start,
        end,
        type: 'CDS',
      })),
    }
  }
  function gene(subfeatures: ReturnType<typeof mrna>[]) {
    return {
      uniqueId: 'gene',
      refName: 'chr1',
      start: 0,
      end: 5000,
      type: 'gene',
      subfeatures,
    }
  }
  const picked = (
    g: ReturnType<typeof gene>,
    canonical?: CanonicalTranscripts,
  ) => {
    const transcripts = getTranscripts(g)
    return transcripts[pickDefaultTranscriptIndex(transcripts, canonical)]!.name
  }

  test('a MANE-tagged shorter isoform beats a longer untagged one', () => {
    const g = gene([
      mrna('long', [0, 5000], [[0, 3000]]),
      mrna('mane', [0, 1000], [[0, 600]], { tag: 'MANE Select' }),
    ])
    expect(picked(g)).toBe('mane')
  })

  test('a tag in a comma-list attribute counts', () => {
    const g = gene([
      mrna('long', [0, 5000], [[0, 3000]]),
      mrna('mane', [0, 1000], [[0, 600]], {
        tag: ['basic', 'MANE_Select'],
      }),
    ])
    expect(picked(g)).toBe('mane')
  })

  test('the track’s own field and tags replace the defaults', () => {
    const g = gene([
      mrna('long', [0, 5000], [[0, 3000]], { tag: 'MANE Select' }),
      mrna('flagged', [0, 1000], [[0, 600]], { canonical: 'yes' }),
    ])
    expect(picked(g, { field: 'canonical', tags: ['yes'] })).toBe('flagged')
  })

  test('coding length beats genomic span', () => {
    const g = gene([
      mrna(
        'wide-intron',
        [0, 5000],
        [
          [0, 100],
          [4900, 5000],
        ],
      ),
      mrna('long-protein', [0, 2000], [[0, 1500]]),
    ])
    expect(picked(g)).toBe('long-protein')
  })

  test('an equal-length tie goes to the later isoform', () => {
    const g = gene([
      mrna('first', [0, 1000], [[0, 600]]),
      mrna('second', [0, 1000], [[0, 600]]),
    ])
    expect(picked(g)).toBe('second')
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
