import { SimpleFeature } from '@jbrowse/core/util'

import {
  LaneGene,
  geneGlyphGeometry,
  geneGlyphShape,
  coveringGene,
  laneGeneFeatures,
} from './geneGlyph.ts'

import type { Span } from './layoutMultiWay.ts'

const CANVAS = 800

// Two exons with an intron between them, and the whole thing mapped 1:1 from bp
// to px so a fixture reads as pixels.
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

const identity = (s: number, e: number): Span => [s, e]

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
    const flipped = geneGlyphGeometry(g, mirrored(0, 100), mirrored)
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
    const clipping = (s: number, e: number) =>
      s >= 50 ? undefined : ([s, Math.min(e, 50)] as Span)
    const px = geneGlyphGeometry(g, [0, 50], clipping)
    expect(px.full).toEqual([[0, 20]])
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

test('geneGlyphShape merges exons across transcripts and falls back to the span', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene1',
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
            uniqueId: 'e1',
            refName: 'chr1',
            start: 100,
            end: 150,
            type: 'exon',
          },
          {
            uniqueId: 'e2',
            refName: 'chr1',
            start: 300,
            end: 400,
            type: 'exon',
          },
        ],
      },
      {
        uniqueId: 'rna2',
        refName: 'chr1',
        start: 100,
        end: 400,
        subfeatures: [
          {
            uniqueId: 'e3',
            refName: 'chr1',
            start: 120,
            end: 200,
            type: 'exon',
          },
        ],
      },
    ],
  })
  expect(geneGlyphShape(gene)).toEqual({
    full: [
      [100, 200],
      [300, 400],
    ],
    thin: [],
  })
  const bare = new SimpleFeature({
    uniqueId: 'bare',
    refName: 'chr1',
    start: 5,
    end: 10,
  })
  expect(geneGlyphShape(bare)).toEqual({ full: [[5, 10]], thin: [] })
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
  expect(geneGlyphShape(gene)).toEqual({
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
  expect(geneGlyphShape(gene)).toEqual({
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
  // the ends only — 150..170 is an intron between two CDS pieces, not UTR
  expect(geneGlyphShape(gene)).toEqual({
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

// The subpart rules are the feature track's own (`isCDS`/`isExon`/`isUTR`),
// which is what these two cover: matching `type === 'CDS'` exactly drew the
// first as one flat full-height box, and a transcript naming its UTRs rather
// than its exons lost them entirely in the second.
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
  expect(geneGlyphShape(gene)).toEqual({
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
  expect(geneGlyphShape(gene)).toEqual({
    full: [[130, 175]],
    thin: [
      [100, 130],
      [175, 200],
    ],
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
    laneGeneFeatures([region, gene, pseudo]).map(g => g.feature.id()),
  ).toEqual(['g', 'p'])
  const mrna = new SimpleFeature({
    uniqueId: 'm',
    refName: 'chr1',
    start: 30,
    end: 40,
    type: 'mRNA',
  })
  expect(laneGeneFeatures([region, mrna]).map(g => g.feature.id())).toEqual([
    'm',
  ])
})

// The anchor lane's genes are fetched over the view's static blocks, so a gene
// straddling a block boundary comes back once per block it touches — two
// glyphs, and two React children under one key.
test('lane genes arriving once per static block draw once', () => {
  const gene = (uniqueId: string) =>
    new SimpleFeature({
      uniqueId,
      refName: 'ctgA',
      start: 900,
      end: 1100,
      type: 'gene',
    })
  expect(laneGeneFeatures([gene('g1'), gene('g1'), gene('g2')])).toHaveLength(2)
})

// The lane draws its annotation where it has one and the table's placement box
// where it does not, and the choice is per GROUP. Made per lane — one drawn
// gene anywhere suppressing every box — a table naming genes the lane's GFF3
// does not left those groups' ribbons hanging off nothing.
describe('a placement box beside the lane annotation', () => {
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

  // which gene, not whether one exists: the covering gene inherits the group
  // key the box would have carried, so two genes over one placement have to
  // resolve to one of them rather than to `true`
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
})
