import { SimpleFeature } from '@jbrowse/core/util'

import { chevronXs, geneGlyphPx } from './geneGlyphPx.ts'

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
