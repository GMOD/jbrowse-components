import { SimpleFeature } from '@jbrowse/core/util'

import {
  chevronXs,
  geneGlyphPx,
  geneGlyphShape,
  isAnnotated,
  laneGeneFeatures,
} from './geneGlyph.ts'

import type { Span } from './layoutMultiWay.ts'

const CANVAS = 800
// one spacing step of slack either side, so a chevron half off the edge still draws
const CHEVRON_REACH = 10

// Two exons with an intron between them, and the whole thing mapped 1:1 from bp
// to px so a fixture reads as pixels.
function gene({
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

describe('chevrons along an intron', () => {
  test('space evenly, one every 10px, inset half a step from each block', () => {
    expect(
      chevronXs(
        0,
        [
          [0, 10],
          [100, 110],
        ],
        CANVAS,
      ),
    ).toEqual([15, 25, 35, 45, 55, 65, 75, 85, 95])
  })

  test('are none at all where the gap is under the minimum', () => {
    expect(
      chevronXs(
        0,
        [
          [0, 10],
          [16, 30],
        ],
        CANVAS,
      ),
    ).toEqual([])
  })

  // The clip, and the whole reason it exists: a lane's frame reaches only the
  // canvas, but the anchor lane runs the view's axis over the whole displayed
  // region. A 50kb intron at 1bp/px is 50,000px of chevrons in one path string,
  // every one of them off screen, rebuilt on every pan.
  test('stop at the canvas rather than running the length of the intron', () => {
    const clipped = chevronXs(
      -20_000,
      [
        [-20_000, -19_990],
        [30_000, 30_010],
      ],
      CANVAS,
    )
    expect(clipped.length).toBeLessThan(100)
    expect(Math.min(...clipped)).toBeGreaterThanOrEqual(-CHEVRON_REACH)
    expect(Math.max(...clipped)).toBeLessThanOrEqual(CANVAS + CHEVRON_REACH)
  })

  // ...and it is a clip, not a re-space: the positions that survive are the
  // ones the unclipped walk would have put there, so nothing shifts as a gene
  // scrolls onto the canvas.
  test('keep the phase the unclipped walk would have had', () => {
    const blocks: Span[] = [
      [-1000, -990],
      [1000, 1010],
    ]
    const wide = chevronXs(-1000, blocks, 1e9)
    const clipped = chevronXs(-1000, blocks, CANVAS)
    expect(clipped.every(x => wide.includes(x))).toBe(true)
    expect(clipped).toEqual(
      wide.filter(x => x >= -CHEVRON_REACH && x <= CANVAS + CHEVRON_REACH),
    )
  })
})

describe('a gene glyph in px', () => {
  test('splits into CDS-less exon boxes and puts the arrow past the far end', () => {
    const g = gene({
      start: 0,
      end: 100,
      exons: [
        [0, 20],
        [80, 100],
      ],
    })
    const px = geneGlyphPx(g, [0, 100], identity, {
      y: 10,
      glyphHeight: 18,
      canvasWidth: CANVAS,
    })
    expect(px.left).toBe(0)
    expect(px.right).toBe(100)
    expect(px.mid).toBe(19)
    expect(px.full).toEqual([
      [0, 20],
      [80, 100],
    ])
    expect(px.thin).toEqual([])
    expect(px.arrow).not.toBe('')
    expect(px.chevrons).not.toBe('')
  })

  test('points the way it reads on a flipped lane, not the way its strand says', () => {
    const g = gene({ start: 0, end: 100, exons: [[0, 100]] })
    const mirrored = (s: number, e: number): Span => [CANVAS - s, CANVAS - e]
    const forward = geneGlyphPx(g, [0, 100], identity, {
      y: 0,
      glyphHeight: 18,
      canvasWidth: CANVAS,
    })
    const flipped = geneGlyphPx(g, mirrored(0, 100), mirrored, {
      y: 0,
      glyphHeight: 18,
      canvasWidth: CANVAS,
    })
    // the arrowhead sits past the gene's high end drawn forward and past its
    // low end drawn mirrored
    expect(forward.arrow.split(' ')[4]).not.toBe(flipped.arrow.split(' ')[4])
    expect(flipped.left).toBe(CANVAS - 100)
    expect(flipped.right).toBe(CANVAS)
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
    const px = geneGlyphPx(g, [0, 50], clipping, {
      y: 0,
      glyphHeight: 18,
      canvasWidth: CANVAS,
    })
    expect(px.full).toEqual([[0, 20]])
  })

  test('draws a strandless gene with no direction marks', () => {
    const g = gene({
      start: 0,
      end: 100,
      exons: [
        [0, 20],
        [80, 100],
      ],
      strand: 0,
    })
    const px = geneGlyphPx(g, [0, 100], identity, {
      y: 0,
      glyphHeight: 18,
      canvasWidth: CANVAS,
    })
    expect(px.chevrons).toBe('')
    expect(px.arrow).toBe('')
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
  expect(laneGeneFeatures([region, gene, pseudo]).map(f => f.id())).toEqual([
    'g',
    'p',
  ])
  const mrna = new SimpleFeature({
    uniqueId: 'm',
    refName: 'chr1',
    start: 30,
    end: 40,
    type: 'mRNA',
  })
  expect(laneGeneFeatures([region, mrna]).map(f => f.id())).toEqual(['m'])
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
    expect(isAnnotated([[10, 40]], [100, 140])).toBe(false)
    expect(isAnnotated([], [100, 140])).toBe(false)
  })

  test('gives way where one does, whichever way round either pair runs', () => {
    expect(isAnnotated([[10, 40]], [30, 80])).toBe(true)
    expect(isAnnotated([[40, 10]], [80, 30])).toBe(true)
  })

  test('is not suppressed by a gene that merely abuts it', () => {
    expect(isAnnotated([[10, 40]], [40, 80])).toBe(false)
  })
})
