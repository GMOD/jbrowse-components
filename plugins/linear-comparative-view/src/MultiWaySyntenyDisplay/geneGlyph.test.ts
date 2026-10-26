import { SimpleFeature } from '@jbrowse/core/util'
import { DEFAULT_CANONICAL_TRANSCRIPTS } from '@jbrowse/core/util/isoformRank'
import { GENE_GLYPH_DEFAULTS } from '@jbrowse/plugin-canvas'

import {
  LaneGene,
  geneGlyphGeometry,
  geneGlyphShape,
  annotatedSpans,
  laneGeneFeatures,
  laneIsoformSettings,
} from './geneGlyph.ts'

import type { Span } from './layoutMultiWay.ts'

const CANVAS = 800

// Two exons around an intron, bp mapped 1:1 to px.
function gene(opts: Parameters<typeof geneFeature>[0]) {
  return new LaneGene(geneFeature(opts))
}

function geneFeature({
  start,
  end,
  exons,
  strand = 1,
}: {
  start: number
  end: number
  exons: [number, number][]
  strand?: number
}) {
  return new SimpleFeature({
    uniqueId: 'g',
    refName: 'chr1',
    start,
    end,
    strand,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 'g-mrna',
        refName: 'chr1',
        start,
        end,
        type: 'mRNA',
        subfeatures: exons.map(([s, e], i) => ({
          uniqueId: `g-exon-${i}`,
          refName: 'chr1',
          start: s,
          end: e,
          type: 'exon',
        })),
      },
    ],
  })
}

const identity = (s: number, e: number): Span[] => [[s, e]]

describe('a gene glyph in px', () => {
  test('splits into CDS-less exon boxes and reads forward', () => {
    const g = gene({
      start: 0,
      end: 100,
      exons: [
        [0, 20],
        [80, 100],
      ],
    })
    const px = geneGlyphGeometry(g, [0, 100], identity)
    expect(px.left).toBe(0)
    expect(px.right).toBe(100)
    expect(px.pxDir).toBe(1)
    expect(px.full).toEqual([
      [0, 20],
      [80, 100],
    ])
    expect(px.thin).toEqual([])
  })

  test('points the way it reads on a flipped lane, not the way its strand says', () => {
    const g = gene({ start: 0, end: 100, exons: [[0, 100]] })
    const mirrored = (s: number, e: number): Span => [CANVAS - s, CANVAS - e]
    const forward = geneGlyphGeometry(g, [0, 100], identity)
    const flipped = geneGlyphGeometry(g, mirrored(0, 100), (s, e) => [
      mirrored(s, e),
    ])
    expect(forward.pxDir).toBe(1)
    expect(flipped.pxDir).toBe(-1)
    expect(flipped.left).toBe(CANVAS - 100)
    expect(flipped.right).toBe(CANVAS)
    expect(flipped.full).toEqual([[CANVAS - 100, CANVAS]])
  })

  test('leaves out the intervals its lane cannot reach', () => {
    const g = gene({
      start: 0,
      end: 100,
      exons: [
        [0, 20],
        [80, 100],
      ],
    })
    const clipping = (s: number, e: number): Span[] =>
      s >= 50 ? [] : [[s, Math.min(e, 50)]]
    const px = geneGlyphGeometry(g, [0, 50], clipping)
    expect(px.full).toEqual([[0, 20]])
  })

  test('connects only the drawn transcript, not a childless one beside it', () => {
    const feature = geneFeature({
      start: 100,
      end: 300,
      exons: [
        [100, 150],
        [250, 300],
      ],
    })
    const lncRNA = new SimpleFeature({
      uniqueId: 'lnc',
      refName: 'chr1',
      start: 100,
      end: 900,
      type: 'lnc_RNA',
    })
    const g = new LaneGene(
      new SimpleFeature({
        ...feature.toJSON(),
        end: 900,
        subfeatures: [...feature.toJSON().subfeatures!, lncRNA.toJSON()],
      }),
    )
    const px = geneGlyphGeometry(g, [100, 300], identity)
    expect(px.pieces).toEqual([[100, 300]])
    expect(px.introns).toEqual([[150, 250]])
  })

  test('draws a strandless gene with no direction', () => {
    const g = gene({
      start: 0,
      end: 100,
      exons: [
        [0, 20],
        [80, 100],
      ],
      strand: 0,
    })
    expect(geneGlyphGeometry(g, [0, 100], identity).pxDir).toBe(0)
  })
})

const cds = (uniqueId: string, start: number, end: number) => ({
  uniqueId,
  refName: 'chr1',
  start,
  end,
  type: 'CDS',
})

function shapeOf(feature: SimpleFeature) {
  const { full, thin } = geneGlyphShape(feature)
  return { full, thin }
}

test('geneGlyphShape draws one transcript, never a union of every isoform', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene1',
    refName: 'chr1',
    start: 100,
    end: 400,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 'rna1',
        refName: 'chr1',
        start: 100,
        end: 400,
        type: 'mRNA',
        subfeatures: [cds('c1', 100, 200), cds('c2', 300, 400)],
      },
      {
        uniqueId: 'rna2',
        refName: 'chr1',
        start: 180,
        end: 320,
        type: 'mRNA',
        subfeatures: [cds('c3', 180, 320)],
      },
    ],
  })
  const shape = geneGlyphShape(gene)
  expect(shape.transcript.id()).toBe('rna1')
  expect(shapeOf(gene)).toEqual({
    full: [
      [100, 200],
      [300, 400],
    ],
    thin: [],
  })
})

test('geneGlyphShape draws the transcript a canonical tag names over a longer one', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene8',
    refName: 'chr1',
    start: 100,
    end: 900,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 'long',
        refName: 'chr1',
        start: 100,
        end: 900,
        type: 'mRNA',
        subfeatures: [cds('c1', 100, 900)],
      },
      {
        uniqueId: 'select',
        refName: 'chr1',
        start: 200,
        end: 400,
        type: 'mRNA',
        tag: 'MANE Select',
        subfeatures: [cds('c2', 200, 400)],
      },
    ],
  })
  expect(geneGlyphShape(gene).transcript.id()).toBe('select')
  expect(
    geneGlyphShape(gene, {
      ...laneIsoformSettings(),
      canonicalTranscriptTags: ['nothing'],
    }).transcript.id(),
  ).toBe('long')
})

test('geneGlyphShape draws a childless transcript as its own span', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene9',
    refName: 'chr1',
    start: 100,
    end: 900,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 'rna',
        refName: 'chr1',
        start: 100,
        end: 900,
        type: 'transcript',
      },
    ],
  })
  expect(shapeOf(gene)).toEqual({ full: [[100, 900]], thin: [] })
})

test('geneGlyphShape draws a polyprotein CDS as its own span, a discontinuous one by its rows', () => {
  const peptide = (uniqueId: string, start: number, end: number) => ({
    uniqueId,
    refName: 'chr1',
    start,
    end,
    type: 'mature_protein_region_of_CDS',
  })
  const polyprotein = new SimpleFeature({
    uniqueId: 'gene10',
    refName: 'chr1',
    start: 100,
    end: 900,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 'poly',
        refName: 'chr1',
        start: 100,
        end: 900,
        type: 'CDS',
        subfeatures: [peptide('p1', 100, 500), peptide('p2', 500, 900)],
      },
    ],
  })
  expect(shapeOf(polyprotein)).toEqual({ full: [[100, 900]], thin: [] })

  const slipped = new SimpleFeature({
    uniqueId: 'gene11',
    refName: 'chr1',
    start: 100,
    end: 900,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 'slip',
        refName: 'chr1',
        start: 100,
        end: 900,
        type: 'CDS',
        subfeatures: [cds('s1', 100, 400), cds('s2', 450, 900)],
      },
    ],
  })
  expect(shapeOf(slipped)).toEqual({
    full: [
      [100, 400],
      [450, 900],
    ],
    thin: [],
  })
})

test('geneGlyphShape falls back to the span', () => {
  const bare = new SimpleFeature({
    uniqueId: 'bare',
    refName: 'chr1',
    start: 5,
    end: 10,
  })
  expect(shapeOf(bare)).toEqual({ full: [[5, 10]], thin: [] })
})

test('geneGlyphShape splits merged exons into CDS and UTR intervals', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene2',
    refName: 'chr1',
    start: 100,
    end: 400,
    subfeatures: [
      {
        uniqueId: 'rna1',
        refName: 'chr1',
        start: 100,
        end: 400,
        subfeatures: [
          {
            uniqueId: 'x1',
            refName: 'chr1',
            start: 100,
            end: 160,
            type: 'exon',
          },
          {
            uniqueId: 'x2',
            refName: 'chr1',
            start: 300,
            end: 400,
            type: 'exon',
          },
          {
            uniqueId: 'c1',
            refName: 'chr1',
            start: 140,
            end: 160,
            type: 'CDS',
          },
          {
            uniqueId: 'c2',
            refName: 'chr1',
            start: 300,
            end: 380,
            type: 'CDS',
          },
        ],
      },
    ],
  })
  expect(shapeOf(gene)).toEqual({
    full: [
      [140, 160],
      [300, 380],
    ],
    thin: [
      [100, 140],
      [380, 400],
    ],
  })
})

test('geneGlyphShape draws a CDS-only annotation full height', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene3',
    refName: 'chr1',
    start: 100,
    end: 200,
    subfeatures: [
      { uniqueId: 'c1', refName: 'chr1', start: 100, end: 150, type: 'CDS' },
      { uniqueId: 'c2', refName: 'chr1', start: 170, end: 200, type: 'CDS' },
    ],
  })
  expect(shapeOf(gene)).toEqual({
    full: [
      [100, 150],
      [170, 200],
    ],
    thin: [],
  })
})

test('geneGlyphShape implies a CDS-only annotation’s UTRs from its own bounds', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene6',
    refName: 'chr1',
    start: 80,
    end: 240,
    subfeatures: [
      { uniqueId: 'c1', refName: 'chr1', start: 100, end: 150, type: 'CDS' },
      { uniqueId: 'c2', refName: 'chr1', start: 170, end: 200, type: 'CDS' },
    ],
  })
  // 150..170 is an intron between two CDS pieces, not UTR
  expect(shapeOf(gene)).toEqual({
    full: [
      [100, 150],
      [170, 200],
    ],
    thin: [
      [80, 100],
      [200, 240],
    ],
  })
})

test('geneGlyphShape reads a lowercase cds the way the feature track does', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene4',
    refName: 'chr1',
    start: 100,
    end: 200,
    subfeatures: [
      { uniqueId: 'e1', refName: 'chr1', start: 100, end: 200, type: 'Exon' },
      { uniqueId: 'c1', refName: 'chr1', start: 140, end: 180, type: 'cds' },
    ],
  })
  expect(shapeOf(gene)).toEqual({
    full: [[140, 180]],
    thin: [
      [100, 140],
      [180, 200],
    ],
  })
})

test('geneGlyphShape draws explicit UTR rows where a transcript names no exons', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene5',
    refName: 'chr1',
    start: 100,
    end: 200,
    subfeatures: [
      {
        uniqueId: 'u1',
        refName: 'chr1',
        start: 100,
        end: 130,
        type: 'five_prime_UTR',
      },
      { uniqueId: 'c1', refName: 'chr1', start: 130, end: 175, type: 'CDS' },
      {
        uniqueId: 'u2',
        refName: 'chr1',
        start: 175,
        end: 200,
        type: 'three_prime_UTR',
      },
    ],
  })
  expect(shapeOf(gene)).toEqual({
    full: [[130, 175]],
    thin: [
      [100, 130],
      [175, 200],
    ],
  })
})

test('geneGlyphShape draws the representative transcript’s own UTRs', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene7',
    refName: 'chr1',
    start: 100,
    end: 400,
    subfeatures: [
      {
        uniqueId: 'rna1',
        refName: 'chr1',
        start: 100,
        end: 300,
        subfeatures: [
          {
            uniqueId: 'u1',
            refName: 'chr1',
            start: 100,
            end: 150,
            type: 'five_prime_UTR',
          },
          {
            uniqueId: 'c1',
            refName: 'chr1',
            start: 150,
            end: 300,
            type: 'CDS',
          },
        ],
      },
      {
        uniqueId: 'rna2',
        refName: 'chr1',
        start: 200,
        end: 400,
        subfeatures: [
          {
            uniqueId: 'x1',
            refName: 'chr1',
            start: 200,
            end: 400,
            type: 'exon',
          },
          {
            uniqueId: 'c2',
            refName: 'chr1',
            start: 200,
            end: 380,
            type: 'CDS',
          },
        ],
      },
    ],
  })
  expect(shapeOf(gene)).toEqual({
    full: [[200, 380]],
    thin: [[380, 400]],
  })
})

test('a lane ranks isoforms by what its gene track’s feature display reads', () => {
  const settings = (display: Record<string, unknown>) =>
    laneIsoformSettings({
      trackId: 't',
      type: 'FeatureTrack',
      displays: [{ type: 'LinearBasicDisplay', ...display }],
    })
  expect(
    settings({ transcripts: { sort: ['Ensembl'] } }).canonicalTranscriptTags,
  ).toEqual(['Ensembl'])
  expect(
    settings({ transcripts: { field: 'flag' } }).canonicalTranscriptField,
  ).toBe('flag')
  expect(
    settings({ transcripts: { types: ['lnc_RNA'] } }).transcriptTypes,
  ).toEqual(['lnc_RNA'])
  // the raw entry skips the display's lifts, so a v4 name still reads
  expect(
    settings({ canonicalTranscriptTags: ['Ensembl'] }).canonicalTranscriptTags,
  ).toEqual(['Ensembl'])
  expect(settings({ transcriptTypes: ['lnc_RNA'] }).transcriptTypes).toEqual([
    'lnc_RNA',
  ])
  // a frozen entry is unchecked, so a malformed slot falls back
  expect(settings({ transcriptTypes: 'mRNA' }).transcriptTypes).toEqual(
    GENE_GLYPH_DEFAULTS.transcriptTypes,
  )
  expect(laneIsoformSettings()).toEqual({
    transcriptTypes: GENE_GLYPH_DEFAULTS.transcriptTypes,
    canonicalTranscriptField: DEFAULT_CANONICAL_TRANSCRIPTS.field,
    canonicalTranscriptTags: DEFAULT_CANONICAL_TRANSCRIPTS.tags,
  })
})

test('laneGeneFeatures drops the whole-sequence region row, keeps genes', () => {
  const region = new SimpleFeature({
    uniqueId: 'r',
    refName: 'chr1',
    start: 0,
    end: 1000000,
    type: 'region',
  })
  const gene = new SimpleFeature({
    uniqueId: 'g',
    refName: 'chr1',
    start: 10,
    end: 20,
    type: 'gene',
  })
  const pseudo = new SimpleFeature({
    uniqueId: 'p',
    refName: 'chr1',
    start: 30,
    end: 40,
    type: 'pseudogene',
  })
  expect(
    laneGeneFeatures([region, gene, pseudo], laneIsoformSettings()).map(g =>
      g.feature.id(),
    ),
  ).toEqual(['g', 'p'])
  const mrna = new SimpleFeature({
    uniqueId: 'm',
    refName: 'chr1',
    start: 30,
    end: 40,
    type: 'mRNA',
  })
  expect(
    laneGeneFeatures([region, mrna], laneIsoformSettings()).map(g =>
      g.feature.id(),
    ),
  ).toEqual(['m'])
})

test('laneGeneFeatures finds the genes an operon groups, beside top-level ones', () => {
  const gene = (uniqueId: string, start: number) => ({
    uniqueId,
    refName: 'chr1',
    start,
    end: start + 10,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: `${uniqueId}-cds`,
        refName: 'chr1',
        start,
        end: start + 10,
        type: 'CDS',
      },
    ],
  })
  const operon = new SimpleFeature({
    uniqueId: 'op',
    refName: 'chr1',
    start: 0,
    end: 40,
    type: 'operon',
    subfeatures: [gene('a', 0), gene('b', 20)],
  })
  const lone = new SimpleFeature(gene('c', 60))
  const ids = (features: SimpleFeature[]) =>
    laneGeneFeatures(features, laneIsoformSettings()).map(g => g.feature.id())
  expect(ids([operon, lone])).toEqual(['a', 'b', 'c'])
  expect(ids([operon])).toEqual(['a', 'b'])
})

test('lane genes arriving once per static block draw once', () => {
  const gene = (uniqueId: string) =>
    new SimpleFeature({
      uniqueId,
      refName: 'ctgA',
      start: 900,
      end: 1100,
      type: 'gene',
    })
  expect(
    laneGeneFeatures(
      [gene('g1'), gene('g1'), gene('g2')],
      laneIsoformSettings(),
    ),
  ).toHaveLength(2)
})

describe('a placement box beside the lane annotation', () => {
  const coveringGene = (annotated: Span[], span: Span) =>
    annotatedSpans(annotated)(span)

  test('stands where no drawn gene reaches', () => {
    expect(coveringGene([[10, 40]], [100, 140])).toBeUndefined()
    expect(coveringGene([], [100, 140])).toBeUndefined()
  })

  test('gives way where one does, whichever way round either pair runs', () => {
    expect(coveringGene([[10, 40]], [30, 80])?.index).toBe(0)
    expect(coveringGene([[40, 10]], [80, 30])?.index).toBe(0)
  })

  test('is not suppressed by a gene that merely abuts it', () => {
    expect(coveringGene([[10, 40]], [40, 80])).toBeUndefined()
  })

  test('names the gene the placement is mostly under', () => {
    const wide = coveringGene(
      [
        [0, 45],
        [40, 200],
      ],
      [40, 100],
    )
    expect(wide?.index).toBe(1)
    expect(wide?.overlap).toBe(60)
  })

  test('answers the same as a scan over a gene-dense lane', () => {
    const scan = (annotated: Span[], span: Span) => {
      const lo = Math.min(span[0], span[1])
      const hi = Math.max(span[0], span[1])
      let best: { index: number; overlap: number } | undefined
      for (const [index, a] of annotated.entries()) {
        const alo = Math.min(a[0], a[1])
        const ahi = Math.max(a[0], a[1])
        if (ahi > lo && alo < hi) {
          const overlap = Math.min(ahi, hi) - Math.max(alo, lo)
          if (best === undefined || overlap > best.overlap) {
            best = { index, overlap }
          }
        }
      }
      return best
    }
    let seed = 7
    const random = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }
    const annotated: Span[] = Array.from({ length: 2000 }, () => {
      const start = Math.floor(random() * 20_000)
      const length = 1 + Math.floor(random() * 400)
      return random() < 0.2 ? [start + length, start] : [start, start + length]
    })
    const covering = annotatedSpans(annotated)
    for (let i = 0; i < 3000; i++) {
      const start = Math.floor(random() * 20_000)
      const span: Span = [start, start + Math.floor(random() * 300)]
      expect(covering(span)).toEqual(scan(annotated, span))
    }
  })
})
