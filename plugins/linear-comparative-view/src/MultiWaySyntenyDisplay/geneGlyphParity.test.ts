import { SimpleFeature } from '@jbrowse/core/util'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { buildFeatureRenderData } from '@jbrowse/plugin-canvas'

import { LaneGene } from './geneGlyph.ts'
import { buildLaneCells } from './multiwayGeometry.ts'
import { PX_ORIGIN } from './multiwayRenderTypes.ts'

import type { Lane } from './laneStack.ts'
import type { DisplayConfig } from '@jbrowse/plugin-canvas'

/**
 * A lane draws the FEATURE TRACK's gene glyph, through that track's own passes
 * and painters — so this asks the feature track itself what it would emit and
 * compares, rather than restating its geometry as expected numbers here. Every
 * rule that has drifted between the two was a constant one side had a copy of:
 * the UTR height fraction, the CDS/exon type test, which y is a top and which a
 * centre, whether the connector spans the gene or each intron.
 *
 * ONE transcript, so the feature track's per-transcript row and the lane's
 * merged-across-transcripts shape describe the same gene — the merge is the one
 * thing the lane does that the feature track has no counterpart for, and it is
 * not what this pins.
 *
 * The lane's px map is identity, so the two coordinate systems are comparable
 * directly: the feature track emits bp, and a lane cell emits px offset by
 * `PX_ORIGIN`.
 */
const HEIGHT = 10
const GENE_START = 100
const GENE_END = 900

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
  displayDirectionalChevrons: true,
  mouseover: '',
  jexlFilters: [],
  hideSourceFeatures: true,
  color: undefined,
  connectorColor: undefined,
  utrColor: undefined,
  outlineColor: '',
  labels: { name: '', description: '' },
}

const track = buildFeatureRenderData({
  features: [gene],
  featureCount: 1,
  config,
  jexl: createJexlInstance(),
  regionStart: 0,
  regionEnd: 1000,
})

const { glyphs: lane } = buildLaneCells({
  lane: {
    glyphTop: 0,
    genes: [new LaneGene(gene)],
    spanOf: (_refName: string, start: number, end: number) => [start, end],
    placements: new Map(),
  } as unknown as Lane,
  glyphHeight: HEIGHT,
  width: 1000,
  colors: { colorOf: () => 'goldenrod', stroke: '#222', divider: '#ccc' },
})

function spans(positions: ArrayLike<number>, origin: number) {
  const out: [number, number][] = []
  for (let i = 0; i < positions.length; i += 2) {
    out.push([positions[i]! - origin, positions[i + 1]! - origin])
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

// each side against its OWN row top, since the two lay their rows out
// differently — what has to agree is the offset within the row
function offsets(ys: Float32Array, top: number) {
  return [...ys].map(y => Number((y - top).toFixed(3))).sort((a, b) => a - b)
}

const trackTop = Math.min(...track.rectYs)

test('a lane emits the boxes the feature track emits, at its UTR height and centring', () => {
  expect(spans(lane.rectPositions, PX_ORIGIN)).toEqual(
    spans(track.rectPositions, 0),
  )
  expect([...lane.rectHeights].sort()).toEqual([...track.rectHeights].sort())
  expect(offsets(lane.rectYs, 0)).toEqual(offsets(track.rectYs, trackTop))
})

test('a lane connects the introns the feature track connects, on the box centre', () => {
  // the lane's own baseline divider spans the whole canvas and has no
  // counterpart on the feature track, so it is not one of the gene's lines
  const laneIntrons = spans(lane.linePositions, PX_ORIGIN).filter(
    ([start, end]) => start >= GENE_START && end <= GENE_END,
  )
  expect(laneIntrons).toEqual(spans(track.linePositions, 0))
  // `rectYs` is a box top and `lineYs` its centre — half a height apart
  expect(offsets(lane.lineYs, 0)).toContain(HEIGHT / 2)
  expect(offsets(track.lineYs, trackTop)).toContain(HEIGHT / 2)
})

test('a lane points the strand arrow where the feature track points it', () => {
  expect([...lane.arrowXs].map(x => x - PX_ORIGIN)).toEqual([...track.arrowXs])
  expect(offsets(lane.arrowYs, 0)).toEqual(offsets(track.arrowYs, trackTop))
  expect([...lane.arrowDirections]).toEqual([...track.arrowDirections])
})
