import { SimpleFeature } from '@jbrowse/core/util'

import {
  LaneGene,
  annotatedSpans,
  geneGlyphGeometry,
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

  // the index answers exactly what a scan of every gene answered, nested and
  // reversed spans included, and the first drawn gene on a tied overlap
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
