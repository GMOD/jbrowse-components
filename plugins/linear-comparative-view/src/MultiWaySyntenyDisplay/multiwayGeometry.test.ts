import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_X,
} from '@jbrowse/cigar-utils'
import { categoricalColor } from '@jbrowse/core/ui/colors'
import { SimpleFeature } from '@jbrowse/core/util'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import {
  abgrAlpha,
  cssColorToABGR,
  withAbgrAlpha,
} from '@jbrowse/core/util/colorBits'
import { UNIVERSAL_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'

import {
  KIND_BASE,
  KIND_BASE_TILE,
  KIND_MARKER,
} from '../LinearSyntenyRPC/syntenyKinds.ts'
import { NO_OPS } from './alignmentOps.ts'
import { LaneGene } from './geneGlyph.ts'
import { buildLanes } from './laneStack.ts'
import { groupFeatures } from './layoutMultiWay.ts'
import {
  buildBandCell,
  buildLaneCells,
  buildRibbonGeometry,
  mismatchColor,
  buildTickGeometry,
  glyphHitAt,
} from './multiwayGeometry.ts'
import { PX_ORIGIN } from './multiwayRenderTypes.ts'

import type { BuildLanesOpts } from './laneStack.ts'
import type { RowFrame, Span } from './layoutMultiWay.ts'
import type { MultiWayCell } from './multiwayRenderTypes.ts'
import type { Feature } from '@jbrowse/core/util'

const WIDTH = 800

function ops(...pairs: [number, number][]) {
  return Uint32Array.from(pairs.map(([len, op]) => (len << 4) | op))
}
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
  alsoOn: [],
  alsoOnMore: 0,
  fitMin: 1100,
  fitMax: 1400,
}
const cacaoFrame: RowFrame = { ...peachFrame, refName: 'Tc1' }

function stack({
  features,
  assemblyNames = ['grape', 'peach'],
  peach = peachFrame,
  cacao = cacaoFrame,
  contigOf = () => undefined,
  splitStrands = false,
  geneLabelPx = 0,
  layerPx = 0,
}: {
  features: Feature[]
  assemblyNames?: string[]
  peach?: RowFrame
  cacao?: RowFrame
  contigOf?: BuildLanesOpts['contigOf']
  splitStrands?: boolean
  geneLabelPx?: number
  layerPx?: number
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
      ['peach', peach],
      ['cacao', cacao],
    ]),
    laneGeneAdapters: new Map([['grape', {}]]),
    axisSpanOf,
    anchorBpPerPx: 1,
    anchorRegionSpans: [axisSpanOf('chr1', 0, 1000)!],
    contigOf,
    refNameAliasOf: () => undefined,
    width: WIDTH,
    height: HEIGHT,
    splitStrands,
    geneLabelPx,
    layerPx,
  })
}

const goldenrod = { css: 'goldenrod', packed: cssColorToABGR('goldenrod') }
const fills = { fill: () => goldenrod, utr: () => goldenrod.packed }
const colors = {
  genes: fills,
  boxes: fills,
  stroke: 'black',
  divider: 'rgba(0,0,0,0.1)',
}

describe('the ribbons', () => {
  test('an unnamed alignment group is labelled by its anchor locus, not the id its key falls back to', () => {
    const record = new SimpleFeature({
      uniqueId: 'adapter-internal-17',
      refName: 'chr1',
      start: 500,
      end: 600,
      strand: 1,
      assemblyName: 'grape',
      mate: { assemblyName: 'peach', refName: 'Pp1', start: 1500, end: 1600 },
    })
    const { targets } = buildRibbonGeometry({
      stack: stack({ features: [record] }),
      laneLinks: undefined,
      ribbonColor: 'grey',
      drawCurves: false,
      bridgeSkippedLanes: false,
    })
    expect(targets.map(t => t.label)).toEqual(['grape chr1:501..600'])
  })

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
      bridgeSkippedLanes: false,
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
    expect(targets[0]!.label).toBe('g1\ngrape chr1:101..200')
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
      bridgeSkippedLanes: false,
    })
    expect(targets).toHaveLength(1)
    expect(ribbonData(cells, 'ribbons:0').instanceFeatureIdx[0]).toBe(0)
    expect(ribbonData(cells, 'ribbons:1').instanceFeatureIdx[0]).toBe(0)
  })

  test('bridge a group across a lane that places nothing for it', () => {
    const s = stack({
      features: [
        pairFeature('g1', 100, 200, { mate: 'cacao', mateRef: 'Tc1' }),
        pairFeature('g2', 300, 400),
      ],
      assemblyNames: ['grape', 'peach', 'cacao'],
    })
    const build = (bridgeSkippedLanes: boolean) =>
      buildRibbonGeometry({
        stack: s,
        laneLinks: undefined,
        ribbonColor: 'rgba(130,130,130,0.4)',
        drawCurves: false,
        bridgeSkippedLanes,
      })
    const off = build(false)
    expect(off.layers.map(l => l.key)).toEqual(['ribbons:0', 'ribbons:1'])
    expect(ribbonData(off.cells, 'ribbons:0').instanceCount).toBe(1)
    expect(ribbonData(off.cells, 'ribbons:1').instanceCount).toBe(0)

    const { cells, layers, groupTarget } = build(true)
    expect(layers.map(l => l.key)).toEqual([
      'ribbons:0',
      'ribbons:0>2',
      'ribbons:1',
    ])
    expect(ribbonData(cells, 'ribbons:0').instanceCount).toBe(1)
    const bridge = ribbonData(cells, 'ribbons:0>2')
    expect(bridge.instanceCount).toBe(1)
    expect(bridge.instanceFeatureIdx[0]).toBe(groupTarget.get('g1'))
    const adjacent = abgrAlpha(ribbonData(cells, 'ribbons:0').colors[0]!)
    expect(adjacent).toBe(Math.round(0.4 * 255))
    expect(abgrAlpha(bridge.colors[0]!)).toBeLessThan(adjacent / 2)
    const [anchorSpan] = s.lanes[0]!.placements.get('g1')!.spans
    const [cacaoSpan] = s.lanes[2]!.placements.get('g1')!.spans
    expect(s.lanes[1]!.placements.has('g1')).toBe(false)
    expect([bridge.bp1[0], bridge.bp2[0]]).toEqual(anchorSpan)
    expect([bridge.bp4[0], bridge.bp3[0]]).toEqual(cacaoSpan)
    expect(cacaoSpan).toEqual([80, 160])
    const layer = layers.find(l => l.key === 'ribbons:0>2')!
    expect(layer.yTop).toBe(s.lanes[0]!.glyphTop + s.glyphHeight)
    expect(layer.height).toBe(s.lanes[2]!.glyphTop - layer.yTop)
  })

  test('do not bridge a nameless record: its group has one mate and no lane it is missing from', () => {
    const nameless = (
      id: string,
      mate: string,
      mateRef: string,
      start: number,
    ) =>
      new SimpleFeature({
        uniqueId: id,
        refName: 'chr1',
        start,
        end: start + 100,
        strand: 1,
        assemblyName: 'grape',
        mate: { assemblyName: mate, refName: mateRef, start: 1500, end: 1600 },
      })
    const s = stack({
      features: [
        nameless('r1', 'peach', 'Pp1', 100),
        nameless('r2', 'cacao', 'Tc1', 300),
      ],
      assemblyNames: ['grape', 'peach', 'cacao'],
    })
    const link = new SimpleFeature({
      uniqueId: 'link',
      refName: 'Pp1',
      start: 1500,
      end: 1600,
      strand: 1,
      assemblyName: 'peach',
      mate: { assemblyName: 'cacao', refName: 'Tc1', start: 1500, end: 1600 },
    })
    const { cells, layers } = buildRibbonGeometry({
      stack: s,
      laneLinks: new Map([['peach|cacao', { links: [link], ops: NO_OPS }]]),
      ribbonColor: 'grey',
      drawCurves: false,
      bridgeSkippedLanes: true,
    })
    expect(s.lanes[1]!.placements.has('r2')).toBe(false)
    expect(s.lanes[2]!.placements.has('r2')).toBe(true)
    expect(layers.map(l => l.key)).toEqual(['ribbons:0', 'ribbons:1'])
    expect(ribbonData(cells, 'ribbons:0').instanceCount).toBe(1)
    expect(ribbonData(cells, 'ribbons:1').instanceCount).toBe(1)
  })

  test('a lane pair’s own deletion is the gap between two tiles of its ribbon', () => {
    const s = stack({
      features: [
        pairFeature('g1', 100, 200),
        pairFeature('g2', 300, 400, { mate: 'cacao', mateRef: 'Tc1' }),
      ],
      assemblyNames: ['grape', 'peach', 'cacao'],
    })
    const link = new SimpleFeature({
      uniqueId: 'link',
      refName: 'Pp1',
      start: 1500,
      end: 1600,
      strand: 1,
      assemblyName: 'peach',
      mate: { assemblyName: 'cacao', refName: 'Tc1', start: 1500, end: 1580 },
    })
    const { cells } = buildRibbonGeometry({
      stack: s,
      laneLinks: new Map([
        [
          'peach|cacao',
          {
            links: [link],
            ops: new Map([
              ['link', ops([40, CIGAR_M], [20, CIGAR_D], [40, CIGAR_M])],
            ]),
          },
        ],
      ]),
      ribbonColor: 'grey',
      drawCurves: false,
      bridgeSkippedLanes: false,
    })
    const data = ribbonData(cells, 'ribbons:1')
    expect([...data.kinds]).toEqual([KIND_BASE, KIND_BASE])
    // Pp1:1540-1560 left open over the one point Tc1:1540, at 0.8 px/bp from 1000
    expect([data.bp2[0], data.bp1[1], data.bp3[0], data.bp4[1]]).toEqual([
      432, 448, 432, 432,
    ])
  })

  test('a mismatch joins its two bases, however far out the lanes are', () => {
    const s = stack({
      features: [
        pairFeature('g1', 100, 200),
        pairFeature('g2', 300, 400, { mate: 'cacao', mateRef: 'Tc1' }),
      ],
      assemblyNames: ['grape', 'peach', 'cacao'],
    })
    const link = new SimpleFeature({
      uniqueId: 'link',
      refName: 'Pp1',
      start: 1500,
      end: 1600,
      strand: 1,
      assemblyName: 'peach',
      mate: { assemblyName: 'cacao', refName: 'Tc1', start: 1500, end: 1600 },
    })
    const { cells } = buildRibbonGeometry({
      stack: s,
      laneLinks: new Map([
        [
          'peach|cacao',
          {
            links: [link],
            ops: new Map([
              ['link', ops([50, CIGAR_EQ], [1, CIGAR_X], [49, CIGAR_EQ])],
            ]),
          },
        ],
      ]),
      ribbonColor: 'grey',
      drawCurves: false,
      bridgeSkippedLanes: false,
    })
    const data = ribbonData(cells, 'ribbons:1')
    const mark = [...data.kinds].indexOf(KIND_BASE_TILE)
    expect([...data.kinds].filter(k => k === KIND_BASE_TILE)).toHaveLength(1)
    // Pp1:1550-1551 onto Tc1:1550-1551, a 0.8px quad the renderer widens to 1
    expect([
      data.bp1[mark],
      data.bp2[mark],
      data.bp4[mark],
      data.bp3[mark],
    ]).toEqual([440, 440.8, 440, 440.8].map(Math.fround))
    expect(data.colors[mark]).toBe(mismatchColor(''))
  })

  // 25 bp/px on both lanes, so each cluster of three mismatches spans under a pixel
  test('mismatches sharing a pixel draw as one mark, and a later pixel starts another', () => {
    const wide = { min: 1000, max: 21_000 }
    const s = stack({
      features: [
        pairFeature('g1', 100, 200),
        pairFeature('g2', 300, 400, { mate: 'cacao', mateRef: 'Tc1' }),
      ],
      assemblyNames: ['grape', 'peach', 'cacao'],
      peach: { ...peachFrame, ...wide },
      cacao: { ...cacaoFrame, ...wide },
    })
    const cluster: [number, number][] = [
      [1, CIGAR_X],
      [9, CIGAR_EQ],
      [1, CIGAR_X],
      [9, CIGAR_EQ],
      [1, CIGAR_X],
    ]
    const link = new SimpleFeature({
      uniqueId: 'link',
      refName: 'Pp1',
      start: 1500,
      end: 3500,
      strand: 1,
      assemblyName: 'peach',
      mate: { assemblyName: 'cacao', refName: 'Tc1', start: 1500, end: 3500 },
    })
    const { cells } = buildRibbonGeometry({
      stack: s,
      laneLinks: new Map([
        [
          'peach|cacao',
          {
            links: [link],
            ops: new Map([
              [
                'link',
                ops(...cluster, [979, CIGAR_EQ], ...cluster, [979, CIGAR_EQ]),
              ],
            ]),
          },
        ],
      ]),
      ribbonColor: 'grey',
      drawCurves: false,
      bridgeSkippedLanes: false,
    })
    const data = ribbonData(cells, 'ribbons:1')
    // each mark is its cluster's 3 mismatched bp, not the 21 bp they spread over
    const marks = [...data.kinds].flatMap((k, i) =>
      k === KIND_BASE_TILE ? [i] : [],
    )
    expect(marks).toHaveLength(2)
    expect(marks.map(i => data.colors[i])).toEqual([
      mismatchColor(''),
      mismatchColor(''),
    ])
    expect(marks.flatMap(i => [data.bp1[i], data.bp2[i]])).toEqual(
      [20, 20.12, 60, 60.12].map(Math.fround),
    )
  })

  test('a reverse anchor record’s insertion lands on the mate walked backwards', () => {
    const record = new SimpleFeature({
      uniqueId: 'r1',
      refName: 'chr1',
      start: 100,
      end: 200,
      strand: -1,
      assemblyName: 'grape',
      mate: { assemblyName: 'peach', refName: 'Pp1', start: 1100, end: 1220 },
    })
    const { cells } = buildRibbonGeometry({
      stack: stack({ features: [record] }),
      anchorOps: new Map([
        ['r1', ops([50, CIGAR_M], [20, CIGAR_I], [50, CIGAR_M])],
      ]),
      laneLinks: undefined,
      ribbonColor: 'grey',
      drawCurves: false,
      bridgeSkippedLanes: false,
    })
    const data = ribbonData(cells, 'ribbons:0')
    expect([...data.kinds]).toEqual([KIND_BASE, KIND_BASE])
    // the anchor meets itself at chr1:150; the mate opens 20 bp between the tiles
    expect([data.bp2[0], data.bp1[1]]).toEqual([120, 120])
    expect(Math.abs(data.bp3[0]! - data.bp4[1]!)).toBe(16)
  })

  // peach reaches Pp1:500-2500, so the tile reaching Pp1:300 is cut at Pp1:500
  test.each([
    [
      'forward',
      1,
      false,
      [[80, 720, -400, 80]],
      [
        [80, 400, -400, -240],
        [400, 720, -240, 80],
      ],
    ],
    [
      'reverse',
      -1,
      false,
      [[80, 720, 80, -400]],
      [
        [80, 400, 80, -240],
        [400, 720, -240, -400],
      ],
    ],
    [
      'reverse, flipped',
      -1,
      true,
      [[80, 720, 720, 1200]],
      [
        [80, 400, 720, 1040],
        [400, 720, 1040, 1200],
      ],
    ],
  ])(
    'a %s record crossing the lane’s reach edge clips its tiles there',
    (_, strand, flipped, whole, split) => {
      const tiles = (...cigar: [number, number][]) => {
        const record = new SimpleFeature({
          uniqueId: 'r1',
          refName: 'chr1',
          start: 100,
          end: 900,
          strand,
          assemblyName: 'grape',
          mate: {
            assemblyName: 'peach',
            refName: 'Pp1',
            start: 300,
            end: 1100,
          },
        })
        const data = ribbonData(
          buildRibbonGeometry({
            stack: stack({
              features: [record],
              peach: { ...peachFrame, flipped },
            }),
            anchorOps: new Map([['r1', ops(...cigar)]]),
            laneLinks: undefined,
            ribbonColor: 'grey',
            drawCurves: false,
            bridgeSkippedLanes: false,
          }).cells,
          'ribbons:0',
        )
        return Array.from({ length: data.instanceCount }, (_, i) => [
          data.bp1[i],
          data.bp2[i],
          data.bp4[i],
          data.bp3[i],
        ])
      }
      expect(tiles([800, CIGAR_M])).toEqual(whole)
      expect(tiles([400, CIGAR_M], [400, CIGAR_M])).toEqual(split)
    },
  )

  // g2's record is reverse against the anchor, g1's forward
  test('color by strand reads the record’s strand, at the slot color’s alpha', () => {
    const s = stack({
      features: [
        pairFeature('g1', 100, 200),
        pairFeature('g2', 300, 400, { strand: -1 }),
      ],
    })
    const { cells } = buildRibbonGeometry({
      stack: s,
      laneLinks: undefined,
      ribbonColor: 'rgba(130,130,130,0.4)',
      ribbonColorField: 'strand',
      drawCurves: false,
      bridgeSkippedLanes: false,
    })
    const data = ribbonData(cells, 'ribbons:0')
    const alpha = Math.round(0.4 * 255)
    const [forward, reverse] = UNIVERSAL_FIELD_PRESETS.strand.range
    expect(data.colors[0]).toBe(withAbgrAlpha(cssColorToABGR(forward), alpha))
    expect(data.colors[1]).toBe(withAbgrAlpha(cssColorToABGR(reverse), alpha))
  })

  // g2 is an inversion drawn uncrossed; g1 runs forward, drawn crossed
  test('color by strand reads the record, not the drawn twist, on a flipped lane', () => {
    const s = stack({
      features: [
        pairFeature('g1', 100, 200),
        pairFeature('g2', 300, 400, { strand: -1 }),
      ],
      peach: { ...peachFrame, flipped: true },
    })
    const { cells } = buildRibbonGeometry({
      stack: s,
      laneLinks: undefined,
      ribbonColor: 'rgba(130,130,130,0.4)',
      ribbonColorField: 'strand',
      drawCurves: false,
      bridgeSkippedLanes: false,
    })
    const data = ribbonData(cells, 'ribbons:0')
    const crossed = (i: number) =>
      Math.sign(data.bp2[i]! - data.bp1[i]!) !==
      Math.sign(data.bp3[i]! - data.bp4[i]!)
    expect([crossed(0), crossed(1)]).toEqual([true, false])
    const alpha = Math.round(0.4 * 255)
    const [forward, reverse] = UNIVERSAL_FIELD_PRESETS.strand.range
    expect(data.colors[0]).toBe(withAbgrAlpha(cssColorToABGR(forward), alpha))
    expect(data.colors[1]).toBe(withAbgrAlpha(cssColorToABGR(reverse), alpha))
  })

  test('color by identity ramps the pair’s attribute and leaves a pair without one at the slot color', () => {
    const s = stack({
      features: [
        new SimpleFeature({
          ...pairFeature('g1', 100, 200).toJSON(),
          identity: 1,
        }),
        pairFeature('g2', 300, 400),
      ],
    })
    const { cells } = buildRibbonGeometry({
      stack: s,
      laneLinks: undefined,
      ribbonColor: 'rgba(130,130,130,0.4)',
      ribbonColorField: 'identity',
      drawCurves: false,
      bridgeSkippedLanes: false,
    })
    const data = ribbonData(cells, 'ribbons:0')
    const alpha = Math.round(0.4 * 255)
    expect(abgrAlpha(data.colors[0]!)).toBe(alpha)
    expect(data.colors[1]).toBe(
      withAbgrAlpha(cssColorToABGR(NO_CATEGORY_COLOR), alpha),
    )
    expect(data.colors[0]).not.toBe(data.colors[1])
  })

  test('color by a text column reads the label table, at the slot color’s alpha', () => {
    const s = stack({
      features: [
        new SimpleFeature({
          ...pairFeature('g1', 100, 200).toJSON(),
          group: 'A1a',
          color: '#4DB5E3',
        }),
        new SimpleFeature({
          ...pairFeature('g2', 300, 400).toJSON(),
          group: 'B1',
        }),
        pairFeature('g3', 500, 600),
      ],
    })
    const { cells } = buildRibbonGeometry({
      stack: s,
      laneLinks: undefined,
      ribbonColor: 'rgba(130,130,130,0.4)',
      ribbonColorField: 'group',
      attributeRanges: {
        group: { labels: ['B1', 'A1a'], colors: { A1a: '#4DB5E3' } },
      },
      drawCurves: false,
      bridgeSkippedLanes: false,
    })
    const data = ribbonData(cells, 'ribbons:0')
    const alpha = Math.round(0.4 * 255)
    expect(data.colors[0]).toBe(withAbgrAlpha(cssColorToABGR('#4DB5E3'), alpha))
    expect(data.colors[1]).toBe(
      withAbgrAlpha(cssColorToABGR(categoricalColor('B1')), alpha),
    )
    expect(data.colors[2]).toBe(cssColorToABGR('rgba(130,130,130,0.4)'))

    const hidden = ribbonData(
      buildRibbonGeometry({
        stack: s,
        laneLinks: undefined,
        ribbonColor: 'rgba(130,130,130,0.4)',
        ribbonColorField: 'group',
        attributeRanges: {
          group: { labels: ['B1', 'A1a'], colors: { A1a: '#4DB5E3' } },
        },
        hideUnlabelled: true,
        drawCurves: false,
        bridgeSkippedLanes: false,
      }).cells,
      'ribbons:0',
    )
    expect(hidden.colors[1]).toBe(data.colors[1])
    expect(abgrAlpha(hidden.colors[2]!)).toBe(0)
  })

  test('color by dN/dS or a numeric column ramps it, and a pair without one keeps the slot color', () => {
    const s = stack({
      features: [
        new SimpleFeature({
          ...pairFeature('g1', 100, 200).toJSON(),
          dn: 0.1,
          ds: 0.4,
          ks: 0.2,
        }),
        new SimpleFeature({
          ...pairFeature('g2', 300, 400).toJSON(),
          dn: 0.8,
          ds: 0.4,
          ks: 1.6,
        }),
        pairFeature('g3', 500, 600),
      ],
    })
    const colorsBy = (ribbonColorField: 'dnds' | 'ks') =>
      ribbonData(
        buildRibbonGeometry({
          stack: s,
          laneLinks: undefined,
          ribbonColor: 'rgba(130,130,130,0.4)',
          ribbonColorField,
          attributeRanges: {
            dnds: { min: 0.25, max: 2 },
            ks: { min: 0.2, max: 1.6 },
          },
          drawCurves: false,
          bridgeSkippedLanes: false,
        }).cells,
        'ribbons:0',
      ).colors
    for (const colors of [colorsBy('dnds'), colorsBy('ks')]) {
      expect(colors[0]).not.toBe(colors[1])
      expect(abgrAlpha(colors[0]!)).toBe(Math.round(0.4 * 255))
      expect(colors[2]).toBe(
        withAbgrAlpha(cssColorToABGR(NO_CATEGORY_COLOR), Math.round(0.4 * 255)),
      )
    }
  })

  // the gene's two pair rows fold into one group whose feature is the first to arrive
  test.each([
    ['peach row first', true],
    ['cacao row first', false],
  ])(
    'color by a per-pair column reads each gutter’s own pair row, %s',
    (_, peachFirst) => {
      const peachRow = new SimpleFeature({
        ...pairFeature('g1', 100, 200).toJSON(),
        group: 'P',
      })
      const cacaoRow = new SimpleFeature({
        ...pairFeature('g1', 100, 200, {
          mate: 'cacao',
          mateRef: 'Tc1',
        }).toJSON(),
        group: 'C',
      })
      const s = stack({
        features: peachFirst ? [peachRow, cacaoRow] : [cacaoRow, peachRow],
        assemblyNames: ['grape', 'peach', 'cacao'],
      })
      const { cells, targets, records } = buildRibbonGeometry({
        stack: s,
        laneLinks: undefined,
        ribbonColor: 'rgba(130,130,130,0.4)',
        ribbonColorField: 'group',
        attributeRanges: {
          group: { labels: ['P', 'C'], colors: { P: '#f00', C: '#00f' } },
        },
        drawCurves: false,
        bridgeSkippedLanes: false,
      })
      const alpha = Math.round(0.4 * 255)
      const drawn = (key: string) => {
        const data = ribbonData(cells, key)
        expect(data.instanceCount).toBe(1)
        return {
          color: data.colors[0],
          opens:
            records.get(key)?.get(0) ??
            targets[data.instanceFeatureIdx[0]!]!.feature,
        }
      }
      expect(drawn('ribbons:0')).toEqual({
        color: withAbgrAlpha(cssColorToABGR('#f00'), alpha),
        opens: peachRow,
      })
      expect(drawn('ribbons:1')).toEqual({
        color: withAbgrAlpha(cssColorToABGR('#00f'), alpha),
        opens: cacaoRow,
      })
      expect(targets).toHaveLength(1)
      const boxFeature = (row: number) =>
        buildLaneCells({
          lane: s.lanes[row]!,
          genes: [],
          glyphHeight: s.glyphHeight,
          width: WIDTH,
          colors,
        }).boxes.hits[0]!.feature
      expect(boxFeature(1)).toBe(peachRow)
      expect(boxFeature(2)).toBe(cacaoRow)
    },
  )

  test('leave out a pair too thin to read on both ends', () => {
    const s = stack({ features: [pairFeature('g1', 100, 101)] })
    const { cells } = buildRibbonGeometry({
      stack: s,
      laneLinks: undefined,
      ribbonColor: 'grey',
      drawCurves: false,
      bridgeSkippedLanes: false,
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
      laneLinks: new Map([['peach|cacao', { links: [link], ops: NO_OPS }]]),
      ribbonColor: 'grey',
      drawCurves: true,
      bridgeSkippedLanes: false,
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

describe('a source stating each lane against the anchor alone', () => {
  // peach draws at half the anchor's scale, so its px differ from the anchor's
  const s = stack({
    features: [
      pairFeature('g1', 100, 200),
      pairFeature('g1', 100, 200, { mate: 'cacao', mateRef: 'Tc1' }),
    ],
    assemblyNames: ['grape', 'peach', 'cacao'],
    peach: { ...peachFrame, min: 0, max: 2000 },
  })
  const topEdges = (rowsVsAnchor: boolean) => {
    const { cells } = buildRibbonGeometry({
      stack: s,
      laneLinks: undefined,
      ribbonColor: 'grey',
      drawCurves: false,
      bridgeSkippedLanes: false,
      rowsVsAnchor,
    })
    return ['ribbons:0', 'ribbons:1'].map(key => {
      const data = ribbonData(cells, key)
      return [data.bp1[0], data.bp2[0]]
    })
  }

  test('every gutter takes its top edge from the anchor', () => {
    const [first, second] = topEdges(true)
    expect(second).toEqual(first)
  })

  test('a source stating neighbour pairs takes it from the lane above', () => {
    const [first, second] = topEdges(false)
    expect(second).not.toEqual(first)
  })
})

// a record cut at an indel arrives as runs sharing one syntenyId, numbered per run
test('the runs of one clipped record draw one ribbon each', () => {
  const run = (i: number, anchor: [number, number], mate: [number, number]) =>
    new SimpleFeature({
      uniqueId: `r1:0-1000/${i}`,
      syntenyId: `7:0-1000/${i}`,
      refName: 'chr1',
      start: anchor[0],
      end: anchor[1],
      strand: 1,
      assemblyName: 'grape',
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: mate[0],
        end: mate[1],
      },
    })
  const s = stack({
    features: [
      run(0, [100, 200], [1100, 1200]),
      run(1, [300, 400], [1200, 1300]),
    ],
  })
  const { cells } = buildRibbonGeometry({
    stack: s,
    laneLinks: undefined,
    ribbonColor: 'rgba(130,130,130,0.3)',
    drawCurves: false,
    bridgeSkippedLanes: false,
  })
  const data = ribbonData(cells, 'ribbons:0')
  expect(data.instanceCount).toBe(2)
  expect([data.bp1[0], data.bp2[0], data.bp4[0], data.bp3[0]]).toEqual([
    80, 160, 80, 160,
  ])
  expect([data.bp1[1], data.bp2[1], data.bp4[1], data.bp3[1]]).toEqual([
    240, 320, 160, 240,
  ])
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

test('the ticks stop where the lane’s baseline stops, at its contig end', () => {
  const s = stack({
    features: [pairFeature('g1', 100, 200)],
    contigOf: () => ({ start: 0, end: 1500 }),
  })
  expect(s.lanes[1]!.baseline).toEqual([[-800, 400]])
  const { cells } = buildTickGeometry({
    stack: s,
    tickIntervalBp: 200,
    width: WIDTH,
    color: 'rgba(0,0,0,0.12)',
  })
  expect([...ribbonData(cells, 'ticks:1').bp1]).toEqual([
    -320, -160, 0, 160, 320,
  ])
})

describe('the band cell', () => {
  const s = stack({
    features: [
      pairFeature('g1', 100, 200),
      pairFeature('g1', 100, 200, { mate: 'cacao', mateRef: 'Tc1' }),
    ],
    assemblyNames: ['grape', 'peach', 'cacao'],
    splitStrands: true,
    geneLabelPx: 12,
    layerPx: 10,
  })
  const paper = cssColorToABGR('#fff')
  const stripe = cssColorToABGR('rgba(0,0,0,0.04)')
  const gutters = buildRibbonGeometry({
    stack: s,
    laneLinks: undefined,
    ribbonColor: 'grey',
    drawCurves: false,
    bridgeSkippedLanes: false,
  }).layers.map(({ yTop, height }) => [yTop, yTop + height] as const)
  const bandsOn = (page: string) =>
    buildBandCell({
      rows: s.lanes,
      glyphHeight: s.glyphHeight,
      width: WIDTH,
      paper: '#fff',
      stripe: 'rgba(0,0,0,0.04)',
      page,
    })
  const rectsIn = (page: string, color: number) => {
    const cell = bandsOn(page)
    return [...cell.rectColors].flatMap((c, i) =>
      c === color
        ? [[cell.rectYs[i]!, cell.rectYs[i]! + cell.rectHeights[i]!] as const]
        : [],
    )
  }

  test.each(['#fff', '#121212'])(
    'every gutter lies on the paper on a %s page',
    page => {
      expect(gutters).toHaveLength(2)
      const sheets = rectsIn(page, paper)
      for (const [top, bottom] of gutters) {
        expect(sheets.some(([y1, y2]) => y1 <= top && y2 >= bottom)).toBe(true)
      }
    },
  )

  test('on a page of the paper the anchor lane body stays off it, keeping the view gridlines', () => {
    expect(rectsIn('#fff', paper)).toEqual([
      [s.lanes[0]!.glyphTop + s.glyphHeight, s.lanes[2]!.bandEnd],
    ])
    expect(rectsIn('#121212', paper)).toEqual([[0, s.lanes[2]!.bandEnd]])
  })

  test('stripes shade alternate lane bodies and no gutter', () => {
    const stripes = rectsIn('#fff', stripe)
    expect(stripes).toEqual([
      [s.lanes[1]!.layerTop, s.lanes[1]!.glyphTop + s.glyphHeight],
    ])
    for (const [top, bottom] of gutters) {
      for (const [y1, y2] of stripes) {
        expect(y2 <= top || y1 >= bottom).toBe(true)
      }
    }
  })
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
    const s = stack({ features: [pairFeature('g1', 100, 200)] })
    const lane = s.lanes[0]!
    const { glyphs: cell } = buildLaneCells({
      lane,
      genes: [new LaneGene(gene)],
      glyphHeight: s.glyphHeight,
      width: WIDTH,
      colors,
    })
    // the lane's divider, then the gene's own line reading backwards
    expect([...cell.lineDirections]).toEqual([0, -1])
    // rects take the box top, lines and arrows its centre
    const centre = lane.glyphTop + s.glyphHeight / 2
    expect([...cell.lineYs]).toEqual([centre, centre])
    expect([...cell.arrowYs]).toEqual([centre])
    expect(cell.rectYs[2]).toBe(lane.glyphTop)
    expect(cell.outlineColor).toBe(0)
    // one line per gap: the exons cover 80..112 and 144..160
    expect([...cell.linePositions].slice(2)).toEqual([
      PX_ORIGIN + 112,
      PX_ORIGIN + 144,
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
    // at the gene's end; the pass draws it inward from there
    expect(cell.arrowXs[0]).toBe(PX_ORIGIN + 80)
    // no placement box: the gene covers the group's span
    expect(cell.hits.map(h => h.label)).toEqual(['GENE1\ngrape chr1:101..200'])
    expect(glyphHitAt(cell.hits, 100, lane.glyphTop + 1)?.feature).toBe(gene)
    expect(glyphHitAt(cell.hits, 100, lane.glyphTop - 5)).toBeUndefined()
  })

  test('a gene the source names by ID alone is labelled by that ID, and one with neither by its locus', () => {
    const s = stack({ features: [pairFeature('g1', 100, 200)] })
    const unnamed = (id?: string) =>
      new SimpleFeature({
        uniqueId: 'internal-7',
        refName: 'chr1',
        start: 100,
        end: 200,
        type: 'gene',
        ...(id ? { id } : {}),
      })
    const labelOf = (feature: Feature) =>
      buildLaneCells({
        lane: s.lanes[0]!,
        genes: [new LaneGene(feature)],
        glyphHeight: s.glyphHeight,
        width: WIDTH,
        colors,
      }).glyphs.hits[0]!.label
    expect(labelOf(unnamed('gene-g1'))).toBe('gene-g1\ngrape chr1:101..200')
    expect(labelOf(unnamed())).toBe('grape chr1:101..200')
  })

  test('an alignment record no gene reaches draws no box', () => {
    const record = new SimpleFeature({
      uniqueId: 'r1',
      refName: 'chr1',
      start: 500,
      end: 600,
      strand: 1,
      assemblyName: 'grape',
      mate: { assemblyName: 'peach', refName: 'Pp1', start: 1500, end: 1600 },
    })
    const s = stack({ features: [pairFeature('g1', 100, 200), record] })
    const { boxes } = buildLaneCells({
      lane: s.lanes[0]!,
      genes: [new LaneGene(gene)],
      glyphHeight: s.glyphHeight,
      width: WIDTH,
      colors,
    })
    expect(boxes.hits).toEqual([])
  })

  test('a named box keys its name by the gene it is, not where it draws', () => {
    const s = stack({ features: [pairFeature('g2', 500, 600)] })
    const { boxNames } = buildLaneCells({
      lane: s.lanes[0]!,
      genes: [],
      glyphHeight: s.glyphHeight,
      width: WIDTH,
      colors,
    })
    expect(boxNames).toEqual([
      { id: 'box:g2:chr1:500', name: 'g2', left: 400, right: 480, group: 'g2' },
    ])
  })

  test('draws the table’s own box, translucent and outlined, where no gene reaches', () => {
    const s = stack({
      features: [pairFeature('g1', 100, 200), pairFeature('g2', 500, 600)],
    })
    const { glyphs, boxes } = buildLaneCells({
      lane: s.lanes[0]!,
      genes: [new LaneGene(gene)],
      glyphHeight: s.glyphHeight,
      width: WIDTH,
      colors,
    })
    const box = boxes.hits.find(h => h.groupKey === 'g2')!
    expect(box.x1).toBe(400)
    expect(box.x2).toBe(480)
    expect(abgrAlpha(boxes.rectColors[0]!)).toBe(64)
    expect(boxes.outlineColor).toBe(cssColorToABGR(colors.stroke))
    expect(glyphs.outlineColor).toBe(0)
    // g1's gene covers its span, so the gene carries its key; g2 reaches none
    expect(glyphs.hits.map(h => h.groupKey)).toEqual(['g1'])
    expect(boxes.hits.map(h => h.groupKey)).toEqual(['g2'])
    expect(
      glyphHitAt(boxes.hits, 440, s.lanes[0]!.glyphTop + 1)?.groupKey,
    ).toBe('g2')
    expect(
      glyphHitAt(glyphs.hits, 100, s.lanes[0]!.glyphTop + 1)?.groupKey,
    ).toBe('g1')
  })

  // in the reach `a` overlaps more (600 to 501 bp); in bp, `b` does (901 to 600)
  test('a gene straddling the reach is claimed by its widest overlap in bp', () => {
    const record = (name: string, anchor: number, start: number, end: number) =>
      new SimpleFeature({
        uniqueId: name,
        refName: 'chr1',
        start: anchor,
        end: anchor + 100,
        strand: 1,
        name,
        mate: { assemblyName: 'peach', refName: 'Pp1', start, end },
      })
    const s = stack({
      features: [record('a', 100, 1900, 2500), record('b', 300, 1999, 2900)],
    })
    const clipped = new SimpleFeature({
      uniqueId: 'peachGene',
      refName: 'Pp1',
      start: 1800,
      end: 2900,
      strand: 1,
      type: 'gene',
    })
    const claims: (string | undefined)[] = []
    const { glyphs, boxes } = buildLaneCells({
      lane: s.lanes[1]!,
      genes: [new LaneGene(clipped)],
      glyphHeight: s.glyphHeight,
      width: WIDTH,
      colors: {
        ...colors,
        genes: {
          ...fills,
          fill: (_feature, cluster) => {
            claims.push(cluster)
            return goldenrod
          },
        },
      },
    })
    expect(glyphs.hits.map(h => h.groupKey)).toEqual(['b'])
    expect(claims).toEqual(['b'])
    expect(boxes.hits).toEqual([])
  })

  describe('with the strands split', () => {
    const gene = (
      uniqueId: string,
      refName: string,
      start: number,
      strand: number,
    ) =>
      new LaneGene(
        new SimpleFeature({
          uniqueId,
          refName,
          start,
          end: start + 100,
          strand,
          name: uniqueId,
          type: 'gene',
        }),
      )
    const rowsOf = (peach: RowFrame) => {
      const s = stack({
        features: [pairFeature('g1', 100, 200)],
        peach,
        splitStrands: true,
      })
      const lane = s.lanes[1]!
      const { glyphs } = buildLaneCells({
        lane,
        genes: [gene('fwd', 'Pp1', 1300, 1), gene('rev', 'Pp1', 1600, -1)],
        glyphHeight: s.glyphHeight,
        width: WIDTH,
        colors,
      })
      const line = lane.glyphTop + s.glyphHeight / 2
      const side = (name: string) => {
        const hit = glyphs.hits.find(h => h.feature.get('name') === name)!
        return hit.y2 <= line ? 'above' : hit.y1 >= line ? 'below' : 'across'
      }
      return { fwd: side('fwd'), rev: side('rev'), divider: glyphs.lineYs[0] }
    }

    test('a gene reading rightwards sits above the line and one reading leftwards below it', () => {
      const rows = rowsOf(peachFrame)
      expect(rows).toMatchObject({ fwd: 'above', rev: 'below' })
    })

    test('a flipped lane turns its genes over with it', () => {
      expect(rowsOf({ ...peachFrame, flipped: true })).toMatchObject({
        fwd: 'below',
        rev: 'above',
      })
    })
  })
})
