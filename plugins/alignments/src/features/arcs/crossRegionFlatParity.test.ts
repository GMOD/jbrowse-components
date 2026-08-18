import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { arcsToRegionResult } from './arcRegions.ts'
import { computeCrossRegionArcs } from './crossRegionOverlay.ts'
import { drawArcs } from './drawCanvas.ts'
import {
  ARC_SHAPE_ARC,
  ARC_SHAPE_FLAT,
  ARC_SHAPE_FLAT_SPLIT,
} from './shapes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ComputedArc, CrossRegionArc } from './arcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// A read-cloud connector that straddles a seam has to be the SAME MARK as one
// that does not, and it was three different things at once.
//
// The flat mark is a neutral line with the category colour in the two squares at
// its ends (arcFlat.slang / arcMarker.slang, and `flatConnectorTheme.test.ts` for
// why "neutral" is the theme's foreground rather than black). The cross-region
// overlay drew every mark with `palette[arcColorSlot(colorType)]`, which is right
// for a dome and wrong for a bar: the connector came out opaque and saturated,
// carried no squares, and the split variant lost its dash — so the one channel a
// read cloud has for insert size and orientation went missing on exactly the
// arcs a two-region SV view is opened to look at.
//
// Pinned as PARITY against the Canvas2D pass rather than against remembered
// colour strings: both halves of the band are the same picture, and the overlay's
// own header says an arc that moves to it does not change colour.

const BLOCK: DrawBlock = { start: 0, end: 10000, screenStartPx: 0 }
const BP_LENGTH = 10000
const BLOCK_WIDTH = 800
const ARCS_H = 100
const Y_DOMAIN = 1000

// Distinct from every other slot so "the category colour" and "the neutral" can
// be told apart. Arc slot 0 resolves through `colorPairLR` (see
// ARC_SLOT_CATEGORY / swatchPaletteKeys).
const COLORS = makeTestPalette({
  colorPairLR: [1, 0, 0],
  colorFlatConnector: [0, 0, 1],
})

function recordingCtx() {
  const strokes: { style: string; dash: number[] }[] = []
  const fills: { style: string; rect: number[] }[] = []
  let strokeStyle = ''
  let fillStyle = ''
  let dash: number[] = []
  const ctx = {
    set strokeStyle(v: string) {
      strokeStyle = v
    },
    set fillStyle(v: string) {
      fillStyle = v
    },
    set lineWidth(_v: number) {},
    setLineDash(d: number[]) {
      dash = d
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    ellipse() {},
    stroke() {
      strokes.push({ style: strokeStyle, dash: [...dash] })
    },
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ style: fillStyle, rect: [x, y, w, h] })
    },
  } as unknown as Ctx2D
  return { ctx, strokes, fills }
}

function computed(shapeType: number): ComputedArc {
  return {
    p1: { refName: 'ctgA', bp: 1000 },
    p2: { refName: 'ctgA', bp: 3000 },
    colorType: 0,
    shapeType,
    yBp: 700,
    spanBp: 700,
    support: 1,
    key: 'k',
  }
}

// The per-region pass: one block spanning the whole 800px, so bp→x is bp*0.08
// and the overlay below can be handed the same projection.
function paint(shapeType: number) {
  const { ctx, strokes, fills } = recordingCtx()
  drawArcs(
    ctx,
    arcsToRegionResult([computed(shapeType)], []),
    BLOCK,
    BP_LENGTH,
    BLOCK_WIDTH,
    {
      arcsYDomainBp: Y_DOMAIN,
      colors: COLORS,
      readConnectionsLineWidth: 1,
    } as RenderState,
    0,
    ARCS_H,
    false,
    BLOCK_WIDTH,
  )
  return { strokes, fills }
}

// The overlay, on the same projection and the same Y scale `drawArcs` derives
// for itself — `arcYScale` reads a defined domain as the read cloud's log axis,
// which is what the model passes through.
function overlay(shapeType: number) {
  const arc: CrossRegionArc = {
    ...computed(shapeType),
    p1RegionIndex: 0,
    p2RegionIndex: 1,
    p1Dir: 1,
    p2Dir: -1,
  }
  return computeCrossRegionArcs({
    arcs: [arc],
    bpToScreenX: (_refName, bp) => (bp / BP_LENGTH) * BLOCK_WIDTH,
    frame: {
      arcsYDomainBp: Y_DOMAIN,
      arcsYLog: true,
      arcsTop: 0,
      arcsH: ARCS_H,
      pairedArcsDown: false,
      screenWidthPx: BLOCK_WIDTH,
    },
    regionReversed: () => false,
    lineWidth: 1,
    colors: COLORS,
  })[0]!
}

describe('a cross-region read-cloud connector is the mark the canvas draws', () => {
  it('strokes the connector in the neutral, not in its category colour', () => {
    const { strokes } = paint(ARC_SHAPE_FLAT)
    expect(overlay(ARC_SHAPE_FLAT).stroke).toBe(strokes[0]!.style)
    // and that is emphatically not the slot the squares are filled with
    expect(overlay(ARC_SHAPE_FLAT).stroke).not.toBe(
      paint(ARC_SHAPE_FLAT).fills[0]!.style,
    )
  })

  it('carries the two endpoint squares, at the canvas rects', () => {
    const { fills } = paint(ARC_SHAPE_FLAT)
    expect(fills).toHaveLength(2)
    expect(overlay(ARC_SHAPE_FLAT).markers).toEqual(
      fills.map(f => ({
        x: f.rect[0],
        y: f.rect[1],
        width: f.rect[2],
        height: f.rect[3],
        fill: f.style,
      })),
    )
  })

  it('dashes the split variant and only the split variant', () => {
    expect(overlay(ARC_SHAPE_FLAT_SPLIT).dash).toBe(
      paint(ARC_SHAPE_FLAT_SPLIT).strokes[0]!.dash.join(' '),
    )
    expect(paint(ARC_SHAPE_FLAT).strokes[0]!.dash).toEqual([])
    expect(overlay(ARC_SHAPE_FLAT).dash).toBeUndefined()
  })

  it('leaves a dome on its category colour, with no squares and no dash', () => {
    const dome = overlay(ARC_SHAPE_ARC)
    expect(dome.stroke).toBe(paint(ARC_SHAPE_ARC).strokes[0]!.style)
    expect(dome.markers).toBeUndefined()
    expect(dome.dash).toBeUndefined()
    // the canvas draws no squares there either — `numFlatArcs` is 0
    expect(paint(ARC_SHAPE_ARC).fills).toHaveLength(0)
  })
})
