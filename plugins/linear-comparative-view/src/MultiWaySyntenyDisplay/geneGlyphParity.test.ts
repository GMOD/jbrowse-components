import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { buildFeatureRenderData } from '@jbrowse/plugin-canvas'

import { LaneGene } from './geneGlyph.ts'
import { buildLaneCells } from './multiwayGeometry.ts'
import { PX_ORIGIN } from './multiwayRenderTypes.ts'

import type { Lane } from './laneStack.ts'
import type { DisplayConfig } from '@jbrowse/plugin-canvas'

// An identity px map: a lane's px less PX_ORIGIN is the feature track's bp.
const HEIGHT = 10
const GENE_START = 100
const GENE_END = 900

const goldenrod = { css: 'goldenrod', packed: cssColorToABGR('goldenrod') }
const fills = { fill: () => goldenrod, utr: () => goldenrod.packed }

const gene = new SimpleFeature({
  uniqueId: 'geneA',
  refName: 'chr1',
  start: GENE_START,
  end: GENE_END,
  strand: 1,
  name: 'geneA',
  type: 'gene',
  subfeatures: [
    {
      uniqueId: 'tA',
      refName: 'chr1',
      start: GENE_START,
      end: GENE_END,
      strand: 1,
      type: 'mRNA',
      subfeatures: [
        { uniqueId: 'e1', refName: 'chr1', start: 100, end: 300, type: 'exon' },
        { uniqueId: 'e2', refName: 'chr1', start: 500, end: 700, type: 'exon' },
        { uniqueId: 'e3', refName: 'chr1', start: 800, end: 900, type: 'exon' },
        { uniqueId: 'c1', refName: 'chr1', start: 200, end: 300, type: 'CDS' },
        { uniqueId: 'c2', refName: 'chr1', start: 500, end: 700, type: 'CDS' },
        { uniqueId: 'c3', refName: 'chr1', start: 800, end: 850, type: 'CDS' },
      ],
    },
  ],
})

const config: DisplayConfig = {
  featureHeight: HEIGHT,
  subfeatureLabels: 'none',
  transcriptTypes: ['mRNA'],
  canonicalTranscriptField: 'tag',
  canonicalTranscriptTags: [],
  containerTypes: [],
  geneGlyphMode: 'all',
  subParts: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
  impliedUTRs: true,
  mouseover: '',
  filter: [],
  hideSourceFeatures: true,
  color: { value: undefined, field: '' },
  connectorColor: undefined,
  utrColor: undefined,
  labels: { name: '', description: '' },
}

const track = buildFeatureRenderData({
  features: [gene],
  config,
  jexl: createJexlInstance(),
  regionStart: 0,
  regionEnd: 1000,
})

const { glyphs: lane } = buildLaneCells({
  lane: {
    glyphTop: 0,
    spanOf: (_refName: string, start: number, end: number) => [start, end],
    spansOf: (_refName: string, start: number, end: number) => [[start, end]],
    baseline: [[0, 1000]],
    canon: (refName: string) => refName,
    placements: new Map(),
  } as unknown as Lane,
  genes: [new LaneGene(gene)],
  glyphHeight: HEIGHT,
  width: 1000,
  colors: { genes: fills, boxes: fills, stroke: '#222', divider: '#ccc' },
})

const round = (n: number) => Number(n.toFixed(3))

// Each side measures y from its own row top; the two lay rows out differently.
function boxes(
  positions: ArrayLike<number>,
  ys: Float32Array,
  heights: Float32Array,
  origin: number,
  top: number,
) {
  const out: [number, number, number, number][] = []
  for (let i = 0; i < ys.length; i++) {
    out.push([
      positions[i * 2]! - origin,
      positions[i * 2 + 1]! - origin,
      round(ys[i]! - top),
      round(heights[i]!),
    ])
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
}

function lines(
  positions: ArrayLike<number>,
  ys: Float32Array,
  origin: number,
  top: number,
) {
  const out: [number, number, number][] = []
  for (let i = 0; i < ys.length; i++) {
    out.push([
      positions[i * 2]! - origin,
      positions[i * 2 + 1]! - origin,
      round(ys[i]! - top),
    ])
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
}

const trackTop = Math.min(...track.rectYs)

test('a lane emits the boxes the feature track emits, at its UTR height and centring', () => {
  expect(
    boxes(lane.rectPositions, lane.rectYs, lane.rectHeights, PX_ORIGIN, 0),
  ).toEqual(
    boxes(track.rectPositions, track.rectYs, track.rectHeights, 0, trackTop),
  )
})

test('a lane connects the introns the feature track connects, on the box centre', () => {
  // the lane's own baseline has no counterpart on the feature track
  const laneIntrons = lines(
    lane.linePositions,
    lane.lineYs,
    PX_ORIGIN,
    0,
  ).filter(([start, end]) => start >= GENE_START && end <= GENE_END)
  expect(laneIntrons).toEqual(
    lines(track.linePositions, track.lineYs, 0, trackTop),
  )
  // rectYs is a box top and lineYs its centre, half a height below
  expect(laneIntrons.map(l => l[2])).toContain(HEIGHT / 2)
})

test('a lane anchors the strand arrow where the feature track does', () => {
  const arrows = (
    d: {
      arrowXs: ArrayLike<number>
      arrowYs: Float32Array
      arrowDirections: ArrayLike<number>
    },
    origin: number,
    top: number,
  ): [number, number, number][] =>
    [...d.arrowYs]
      .map((y, i): [number, number, number] => [
        d.arrowXs[i]! - origin,
        round(y - top),
        d.arrowDirections[i]!,
      ])
      .sort((a, b) => a[0] - b[0])
  expect(arrows(lane, PX_ORIGIN, 0)).toEqual(arrows(track, 0, trackTop))
})
