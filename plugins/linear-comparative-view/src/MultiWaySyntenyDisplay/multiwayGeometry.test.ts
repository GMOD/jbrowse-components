import { SimpleFeature } from '@jbrowse/core/util'
import { abgrAlpha } from '@jbrowse/core/util/colorBits'

import { KIND_BASE, KIND_MARKER } from '../LinearSyntenyRPC/syntenyColors.ts'
import { LaneGene } from './geneGlyph.ts'
import { buildLanes } from './laneStack.ts'
import { groupFeatures } from './layoutMultiWay.ts'
import {
  buildBandCell,
  buildLaneGlyphCell,
  buildRibbonGeometry,
  buildTickGeometry,
  glyphHitAt,
} from './multiwayGeometry.ts'
import { PX_ORIGIN } from './multiwayRenderTypes.ts'

import type { RowFrame, Span } from './layoutMultiWay.ts'
import type { MultiWayCell } from './multiwayRenderTypes.ts'
import type { Feature } from '@jbrowse/core/util'

const WIDTH = 800
const HEIGHT = 240

function ribbonData(cells: Map<string, MultiWayCell>, key: string) {
  const cell = cells.get(key)!
  if (cell.kind !== 'ribbons') {
    throw new Error(`${key} is not a ribbon cell`)
  }
  return cell.data
}

function pairFeature(
  name: string,
  start: number,
  end: number,
  { mate = 'peach', mateRef = 'Pp1', strand = 1 } = {},
) {
  return new SimpleFeature({
    uniqueId: `${name}-${mate}`,
    refName: 'chr1',
    start,
    end,
    strand,
    name,
    assemblyName: 'grape',
    mate: {
      assemblyName: mate,
      refName: mateRef,
      start: start + 1000,
      end: end + 1000,
    },
  })
}

// chr1:0-1000 across the canvas, 0.8 px/bp, clipped like `axisSpan`
const axisSpanOf = (refName: string, start: number, end: number) =>
  refName === 'chr1'
    ? ([
        (Math.min(Math.max(start, 0), 1000) / 1000) * WIDTH,
        (Math.min(Math.max(end, 0), 1000) / 1000) * WIDTH,
      ] as Span)
    : undefined

const peachFrame: RowFrame = {
  refName: 'Pp1',
  min: 1000,
  max: 2000,
  flipped: false,
  fitMin: 1100,
  fitMax: 1400,
}
const cacaoFrame: RowFrame = { ...peachFrame, refName: 'Tc1' }

function stack({
  features,
  laneGenes,
  assemblyNames = ['grape', 'peach'],
}: {
  features: Feature[]
  laneGenes?: Map<string, LaneGene[]>
  assemblyNames?: string[]
}) {
  const groups = groupFeatures(features)
  return buildLanes({
    assemblyNames,
    groups,
    anchorSpans: new Map(
      groups.map(g => [
        g.key,
        axisSpanOf('chr1', g.anchor.start, g.anchor.end)!,
      ]),
    ),
    rowFrames: new Map([
      ['peach', peachFrame],
      ['cacao', cacaoFrame],
    ]),
    laneGenes,
    laneGeneAdapters: new Map([['grape', {}]]),
    axisSpanOf,
    refNameAliasOf: () => undefined,
    width: WIDTH,
    height: HEIGHT,
  })
}

const colors = {
  colorOf: () => 'goldenrod',
  stroke: 'black',
  divider: 'rgba(0,0,0,0.1)',
}

describe('the ribbons', () => {
  test('join the anchor span to the mate span end to end, and a reverse pair crossed', () => {
    const s = stack({
      features: [
        pairFeature('g1', 100, 200),
        pairFeature('g2', 300, 400, { strand: -1 }),
      ],
    })
    const { cells, layers, targets, groupTarget } = buildRibbonGeometry({
      stack: s,
      laneLinks: undefined,
      ribbonColor: 'rgba(130,130,130,0.3)',
      drawCurves: false,
    })
    expect(layers.map(l => l.key)).toEqual(['ribbons:0'])
    const data = ribbonData(cells, 'ribbons:0')
    expect(data.instanceCount).toBe(2)
    // g1: anchor 80..160 px, mate 1100..1200 in a 1000bp frame → 80..160
    expect([data.bp1[0], data.bp2[0], data.bp4[0], data.bp3[0]]).toEqual([
      80, 160, 80, 160,
    ])
    // g2 reversed: the lower span hands its ends the other way round
    expect([data.bp1[1], data.bp2[1], data.bp4[1], data.bp3[1]]).toEqual([
      240, 320, 320, 240,
    ])
    expect([...data.kinds]).toEqual([KIND_BASE, KIND_BASE])
    expect(data.base0).toBe(0)
    expect(abgrAlpha(data.colors[0]!)).toBe(Math.round(0.3 * 255))
    expect(targets.map(t => t.groupKey)).toEqual(['g1', 'g2'])
    expect([...data.instanceFeatureIdx]).toEqual([
      groupTarget.get('g1'),
      groupTarget.get('g2'),
    ])
    const [layer] = layers
    expect(layer!.yTop).toBe(s.lanes[0]!.glyphTop + s.glyphHeight)
    expect(layer!.height).toBe(s.lanes[1]!.glyphTop - layer!.yTop)
  })

  test('share one target per group across every gutter, so a hover lights the group in all of them', () => {
    const s = stack({
      features: [
        pairFeature('g1', 100, 200),
        pairFeature('g1', 100, 200, { mate: 'cacao', mateRef: 'Tc1' }),
      ],
      assemblyNames: ['grape', 'peach', 'cacao'],
    })
    const { cells, targets } = buildRibbonGeometry({
      stack: s,
      laneLinks: undefined,
      ribbonColor: 'grey',
      drawCurves: false,
    })
    expect(targets).toHaveLength(1)
    expect(ribbonData(cells, 'ribbons:0').instanceFeatureIdx[0]).toBe(0)
    expect(ribbonData(cells, 'ribbons:1').instanceFeatureIdx[0]).toBe(0)
  })

  test('leave out a pair too thin to read on both ends', () => {
    const s = stack({ features: [pairFeature('g1', 100, 101)] })
    const { cells } = buildRibbonGeometry({
      stack: s,
      laneLinks: undefined,
      ribbonColor: 'grey',
      drawCurves: false,
    })
    expect(ribbonData(cells, 'ribbons:0').instanceCount).toBe(0)
  })

  test('draw an alignment-level source’s direct records between mate lanes, from the second gutter', () => {
    const s = stack({
      features: [
        pairFeature('g1', 100, 200),
        pairFeature('g1', 100, 200, { mate: 'cacao', mateRef: 'Tc1' }),
      ],
      assemblyNames: ['grape', 'peach', 'cacao'],
    })
    const link = new SimpleFeature({
      uniqueId: 'link',
      refName: 'Pp1',
      start: 1500,
      end: 1600,
      strand: -1,
      assemblyName: 'peach',
      mate: { assemblyName: 'cacao', refName: 'Tc1', start: 1500, end: 1600 },
    })
    const { cells, targets } = buildRibbonGeometry({
      stack: s,
      laneLinks: new Map([['peach|cacao', [link]]]),
      ribbonColor: 'grey',
      drawCurves: true,
    })
    const data = ribbonData(cells, 'ribbons:1')
    expect(data.instanceCount).toBe(2)
    expect([data.bp1[1], data.bp2[1], data.bp4[1], data.bp3[1]]).toEqual([
      400, 480, 480, 400,
    ])
    expect(targets[data.instanceFeatureIdx[1]!]!.feature).toBe(link)
    expect(targets[data.instanceFeatureIdx[1]!]!.label).toContain('peach')
  })
})

test('the ticks are zero-width markers in each framed lane’s band', () => {
  const s = stack({ features: [pairFeature('g1', 100, 200)] })
  const { cells, layers } = buildTickGeometry({
    stack: s,
    tickIntervalBp: 200,
    width: WIDTH,
    color: 'rgba(0,0,0,0.12)',
  })
  expect(layers.map(l => l.key)).toEqual(['ticks:1'])
  const data = ribbonData(cells, 'ticks:1')
  expect([...data.bp1]).toEqual([
    -320, -160, 0, 160, 320, 480, 640, 800, 960, 1120,
  ])
  expect([...data.bp1]).toEqual([...data.bp3])
  expect([...new Set(data.kinds)]).toEqual([KIND_MARKER])
  expect(layers[0]!.yTop).toBe(s.lanes[1]!.bandTop)
  expect(layers[0]!.height).toBe(s.bandHeight)
})

test('a band covers each mate lane, striped on alternate rows', () => {
  const s = stack({
    features: [
      pairFeature('g1', 100, 200),
      pairFeature('g1', 100, 200, { mate: 'cacao', mateRef: 'Tc1' }),
    ],
    assemblyNames: ['grape', 'peach', 'cacao'],
  })
  const bands = buildBandCell({
    bands: s.lanes,
    width: WIDTH,
    paper: 'white',
    stripe: 'rgba(0,0,0,0.04)',
  })
  expect(bands.rectYs.length).toBe(3)
  expect([...bands.rectPositions]).toEqual([
    PX_ORIGIN,
    PX_ORIGIN + WIDTH,
    PX_ORIGIN,
    PX_ORIGIN + WIDTH,
    PX_ORIGIN,
    PX_ORIGIN + WIDTH,
  ])
  expect(bands.rectYs[0]).toBe(s.lanes[1]!.bandStart)
  expect(bands.rectHeights[2]).toBe(s.lanes[2]!.bandEnd - s.lanes[2]!.bandStart)
})

describe('a lane cell', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene',
    refName: 'chr1',
    start: 100,
    end: 200,
    strand: -1,
    name: 'GENE1',
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 'exon1',
        refName: 'chr1',
        start: 100,
        end: 140,
        type: 'exon',
      },
      { uniqueId: 'cds1', refName: 'chr1', start: 120, end: 140, type: 'CDS' },
      {
        uniqueId: 'exon2',
        refName: 'chr1',
        start: 180,
        end: 200,
        type: 'exon',
      },
    ],
  })

  test('packs a gene as its baseline, UTR and CDS boxes and an arrowhead the way it reads', () => {
    const s = stack({
      features: [pairFeature('g1', 100, 200)],
      laneGenes: new Map([['grape', [new LaneGene(gene)]]]),
    })
    const lane = s.lanes[0]!
    const cell = buildLaneGlyphCell({
      lane,
      glyphHeight: s.glyphHeight,
      width: WIDTH,
      colors,
    })
    // the lane's divider, then the gene's own line reading backwards
    expect([...cell.lineDirections]).toEqual([0, -1])
    expect([...cell.linePositions].slice(2)).toEqual([
      PX_ORIGIN + 80,
      PX_ORIGIN + 160,
    ])
    // exon-minus-CDS thin: 100-120 and 180-200; CDS full: 120-140
    expect([...cell.rectPositions]).toEqual([
      PX_ORIGIN + 80,
      PX_ORIGIN + 96,
      PX_ORIGIN + 144,
      PX_ORIGIN + 160,
      PX_ORIGIN + 96,
      PX_ORIGIN + 112,
    ])
    expect(cell.rectHeights[0]).toBeLessThan(cell.rectHeights[2]!)
    expect(cell.rectHeights[2]).toBe(s.glyphHeight)
    expect([...cell.arrowDirections]).toEqual([-1])
    expect(cell.arrowXs[0]).toBe(PX_ORIGIN + 80)
    // no placement box: the gene covers the group's span
    expect(cell.hits.map(h => h.label)).toEqual(['GENE1'])
    expect(glyphHitAt(cell.hits, 100, lane.glyphTop + 1)?.feature).toBe(gene)
    expect(glyphHitAt(cell.hits, 100, lane.glyphTop - 5)).toBeUndefined()
  })

  test('draws the table’s own box, translucent and outlined, where no gene reaches', () => {
    const s = stack({
      features: [pairFeature('g1', 100, 200), pairFeature('g2', 500, 600)],
      laneGenes: new Map([['grape', [new LaneGene(gene)]]]),
    })
    const cell = buildLaneGlyphCell({
      lane: s.lanes[0]!,
      glyphHeight: s.glyphHeight,
      width: WIDTH,
      colors,
    })
    const box = cell.hits.find(h => h.groupKey === 'g2')!
    expect(box.x1).toBe(400)
    expect(box.x2).toBe(480)
    const boxRect = cell.rectYs.length - 1
    expect(abgrAlpha(cell.rectColors[boxRect]!)).toBe(64)
    expect(cell.outlineColor).not.toBe(0)
    // the box draws over the gene, so it is the hit where both would answer
    expect(glyphHitAt(cell.hits, 440, s.lanes[0]!.glyphTop + 1)?.groupKey).toBe(
      'g2',
    )
  })
})
