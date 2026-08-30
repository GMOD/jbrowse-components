import { ARC_HIT_SLOP_PX } from '@jbrowse/sv-core'

import { ARC_MARKER_PX } from '../../shaders/slang/arcMarker.consts.generated.ts'
import { arcLineWidth } from './arcLineWidth.ts'
import { strokeArcMark } from './drawCanvas.ts'
import { hitTestArcBand } from './hitTest.ts'
import { arcMark } from './mark.ts'
import { ARC_SHAPE_ARC, ARC_SHAPE_FLAT } from './shapes.ts'
import { emptyArcsUploadData } from './types.ts'

import type { ArcHitOptions } from './hitTest.ts'
import type { ArcsUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// bp maps 1:1 to px here, so a screen x IS the bp — the projection is not what
// these tests are about and a 1:1 map keeps every expected coordinate readable.
const bpToScreenX = (bp: number) => bp

const BAND = {
  arcsTop: 0,
  arcsH: 100,
  pairedArcsDown: false,
  lineWidth: 1,
  screenWidthPx: 1000,
  // Arc mode: linear Y, and a domain that makes 1bp of yBp exactly 1px of rise
  // (availH = arcsH - ARC_HEIGHT_MARGIN = 92).
  arcsYDomainBp: 92,
  arcsYLog: false,
  bpToScreenX,
} satisfies ArcHitOptions

function arcsData(
  arcs: {
    x1: number
    x2: number
    yBp: number
    support?: number
    shape?: number
    colorType?: number
  }[],
): ArcsUploadData {
  return {
    ...emptyArcsUploadData(),
    arcX1: new Uint32Array(arcs.map(a => a.x1)),
    arcX2: new Uint32Array(arcs.map(a => a.x2)),
    arcYBp: new Uint32Array(arcs.map(a => a.yBp)),
    arcSpanBp: new Uint32Array(arcs.map(a => a.yBp)),
    arcSupport: new Uint32Array(arcs.map(a => a.support ?? 1)),
    arcShapeTypes: new Uint8Array(arcs.map(a => a.shape ?? ARC_SHAPE_ARC)),
    arcColorTypes: new Uint8Array(arcs.map(a => a.colorType ?? 0)),
    numArcs: arcs.length,
  }
}

// The ellipse `strokeArcMark` actually hands to Canvas2D for these inputs. Sampling
// the hit test against THIS rather than against a re-derivation is the whole
// point: the two would otherwise be two placements of the same arc, free to
// disagree while both look right on their own.
function drawnEllipse(
  sx1: number,
  sx2: number,
  yBp: number,
  down: boolean,
  screenWidthPx: number,
) {
  const mark = arcMark(arcsData([{ x1: sx1, x2: sx2, yBp }]), 0, {
    ...BAND,
    pairedArcsDown: down,
    screenWidthPx,
  })
  if (mark.kind !== 'dome') {
    throw new Error('expected a dome')
  }
  let call: { cx: number; cy: number; rx: number; ry: number } | undefined
  const ctx = {
    beginPath: () => {},
    stroke: () => {},
    ellipse: (cx: number, cy: number, rx: number, ry: number) => {
      call = { cx, cy, rx, ry }
    },
  } as unknown as Ctx2D
  strokeArcMark(ctx, mark)
  return call!
}

// Points on the drawn half-ellipse, at the canvas angles strokeArcMark sweeps.
// The centre comes off the recorded call, so the anchor rule is not spelled a
// second time here either.
function pointsOnDrawnCurve(
  sx1: number,
  sx2: number,
  yBp: number,
  down = false,
  screenWidthPx = BAND.screenWidthPx,
) {
  const e = drawnEllipse(sx1, sx2, yBp, down, screenWidthPx)
  const [start, end] = down ? [0, Math.PI] : [Math.PI, 2 * Math.PI]
  return [0.05, 0.25, 0.5, 0.75, 0.95].map(f => {
    const t = start + f * (end - start)
    return { x: e.cx + e.rx * Math.cos(t), y: e.cy + e.ry * Math.sin(t) }
  })
}

describe('a dome answers along the curve Canvas2D draws', () => {
  const data = arcsData([{ x1: 200, x2: 600, yBp: 40 }])

  test('every point on the drawn curve is a hit', () => {
    for (const p of pointsOnDrawnCurve(200, 600, 40)) {
      expect(hitTestArcBand(p.x, p.y, data, BAND)?.index).toBe(0)
    }
  })

  test('a point well off the curve is not', () => {
    // Inside the dome, halfway up the middle — the arc is a stroke, not a fill,
    // so the enclosed area must not answer.
    expect(hitTestArcBand(400, 80, data, BAND)).toBeUndefined()
    // Outside the span entirely.
    expect(hitTestArcBand(50, 100, data, BAND)).toBeUndefined()
  })

  test('a foot answers from inside the band but the arc does not reach across it', () => {
    // The apex points up, so the anchor line IS the band bottom here. Just
    // inside it, at a foot, is ink; the same column a few px further up is the
    // blank inside of the dome, because the stroke at a vertical tangent runs
    // out sideways rather than along the curve's own direction.
    const foot = 200
    expect(hitTestArcBand(foot, BAND.arcsH - 1, data, BAND)?.index).toBe(0)
    expect(
      hitTestArcBand(foot + ARC_HIT_SLOP_PX + 4, BAND.arcsH - 1, data, BAND),
    ).toBeUndefined()
  })
})

test('a down-pointing band mirrors, and hits the curve it draws', () => {
  const down = { ...BAND, pairedArcsDown: true }
  const data = arcsData([{ x1: 200, x2: 600, yBp: 40 }])
  for (const p of pointsOnDrawnCurve(200, 600, 40, true)) {
    expect(hitTestArcBand(p.x, p.y, data, down)?.index).toBe(0)
  }
  // Above the anchor (which is the band TOP here) is the blank side.
  expect(hitTestArcBand(400, -6, data, down)).toBeUndefined()
})

test('a far pair answers on its near-vertical legs', () => {
  // Span wider than the screen: arcRadiiPx degenerates the dome to a circle on
  // the pair's own half-width, so the band clips everything but two legs rising
  // from the real endpoints.
  const far = { ...BAND, screenWidthPx: 100 }
  const data = arcsData([{ x1: 200, x2: 600, yBp: 40 }])
  // Only the part of that circle inside the band is drawn — the apex sits 200px
  // up in a 100px band — so the clipped-away samples are not hits and asking for
  // them would be asserting the opposite of what the band does.
  const inBand = pointsOnDrawnCurve(200, 600, 40, false, 100).filter(
    p => p.y >= BAND.arcsTop && p.y <= BAND.arcsTop + BAND.arcsH,
  )
  expect(inBand.length).toBeGreaterThan(0)
  for (const p of inBand) {
    expect(hitTestArcBand(p.x, p.y, data, far)?.index).toBe(0)
  }
  // The legs rise AT the endpoints, so the middle of the span is empty even
  // though the pair spans it.
  expect(hitTestArcBand(400, 60, data, far)).toBeUndefined()
})

test('a far pair with a millions-of-px radius still resolves its legs', () => {
  // The case distToWideCirclePx exists for: `length(p - c) - r` cancels away
  // every significant digit at this radius, so a naive distance answers noise.
  const far = { ...BAND, screenWidthPx: 800 }
  const data = arcsData([{ x1: 0, x2: 4_000_000, yBp: 40 }])
  // Just outside the left endpoint's leg, a few px up the band.
  expect(hitTestArcBand(0, BAND.arcsH - 20, data, far)?.index).toBe(0)
  // Ten px to the left of that leg is off it.
  expect(hitTestArcBand(-10, BAND.arcsH - 20, data, far)).toBeUndefined()
})

describe('support widens the target the way it widens the ink', () => {
  const thin = arcsData([{ x1: 200, x2: 600, yBp: 40, support: 1 }])
  const thick = arcsData([{ x1: 200, x2: 600, yBp: 40, support: 64 }])

  test('a thick arc answers where a hairline does not', () => {
    // Straight up from the apex, past the slop a support-1 arc gets.
    const apexY = BAND.arcsH - 0.75 * 40
    const y = apexY - (ARC_HIT_SLOP_PX + 2)
    expect(hitTestArcBand(400, y, thin, BAND)).toBeUndefined()
    expect(hitTestArcBand(400, y, thick, BAND)?.index).toBe(0)
  })

  test('the hit carries the support count, which is what the tooltip reports', () => {
    expect(
      hitTestArcBand(400, BAND.arcsH - 0.75 * 40, thick, BAND)?.support,
    ).toBe(64)
  })
})

// The crowding case: arcs a couple of px apart, one of them the junction the
// picture is ranking as strong. Ranking on centre-line distance gave those
// hovers to whichever hairline the cursor happened to be nearest, so a band
// whose whole point was "this junction has 32 reads behind it" answered
// "supported by 1 read".
//
// Flat (read-cloud) lines, because inside the bar's own span the distance to one
// IS the difference in Y — every number below is readable without solving a
// conic.
//
// Each fixture is in PAINT ORDER, which is `resolveArcs`' output order and the
// invariant the on-ink rule reads: last considered is last drawn. These used to
// be built heavy-first, deliberately against that order, back when the rule
// re-derived paint order from `support` and so could be tested apart from it.
// It cannot be any more — a category-first sort means support no longer implies
// paint order — so a fixture out of feed order is testing a state production
// does not produce. `resolveArcs`' own ordering is pinned in compute.test.ts.
describe('when arcs crowd together, the visible one wins', () => {
  // localY (drawn-side-positive, measured off the anchor at the band bottom) is
  // `arcsH - canvasY`, and yBp maps 1:1 to px in BAND — so an arc at yBp 40 is
  // ink at canvasY 60. Half-widths: support 32 draws 3.75px (1.875 each side),
  // support 1 draws the configured 1px (0.5).
  const y = (localY: number) => BAND.arcsH - localY
  const flat = (yBp: number, support: number) => ({
    x1: 300,
    x2: 500,
    yBp,
    support,
    shape: ARC_SHAPE_FLAT,
  })

  test('on both arcs at once, the heavier one answers', () => {
    // Support-ascending within one category, so the heavy line is the later ink.
    const data = arcsData([flat(42, 1), flat(40, 32)])
    // 1.6px off the thick line's centre — inside its 1.875px half-width — and
    // 0.4px off the hairline's. Both are ink under the cursor; the old rule took
    // the nearer centre and reported the singleton.
    expect(hitTestArcBand(400, y(41.6), data, BAND)?.support).toBe(32)
  })

  test('a singleton the cursor is on beats a heavy neighbour it is not on', () => {
    const data = arcsData([flat(42, 1), flat(38, 32)])
    // Dead on the hairline, 4px off the thick line — past its ink, inside its
    // slop. Support is a tie-break between arcs under the cursor, not a
    // licence to capture hovers on somebody else's stroke.
    expect(hitTestArcBand(400, y(42), data, BAND)?.support).toBe(1)
  })

  test('off every stroke, nearest decides — measured from the ink, not the centre', () => {
    const data = arcsData([flat(44, 1), flat(40, 32)])
    // 2.5px off the thick line and 1.5px off the hairline, on neither: 0.625px
    // outside the thick ink against 1.0px outside the thin. The thick arc is
    // the nearer MARK even though its centre is further away.
    expect(hitTestArcBand(400, y(42.5), data, BAND)?.support).toBe(32)
  })
})

test('the nearest arc wins when two overlap', () => {
  // Two domes sharing a left foot, different apexes. A point on the lower one
  // must not be captured by the higher one passing nearby.
  const data = arcsData([
    { x1: 200, x2: 600, yBp: 40 },
    { x1: 200, x2: 600, yBp: 80 },
  ])
  const low = pointsOnDrawnCurve(200, 600, 40)[2]!
  const high = pointsOnDrawnCurve(200, 600, 80)[2]!
  expect(hitTestArcBand(low.x, low.y, data, BAND)?.index).toBe(0)
  expect(hitTestArcBand(high.x, high.y, data, BAND)?.index).toBe(1)
})

describe('read-cloud flat lines', () => {
  const data = arcsData([
    { x1: 300, x2: 500, yBp: 40, shape: ARC_SHAPE_FLAT, support: 3 },
  ])
  const flatY = BAND.arcsH - 40

  test('answers along the bar and not above it', () => {
    expect(hitTestArcBand(300, flatY, data, BAND)?.index).toBe(0)
    expect(hitTestArcBand(400, flatY, data, BAND)?.index).toBe(0)
    expect(hitTestArcBand(500, flatY, data, BAND)?.index).toBe(0)
    expect(hitTestArcBand(400, flatY - 12, data, BAND)).toBeUndefined()
  })

  test('does not answer past the ends of the bar', () => {
    expect(hitTestArcBand(520, flatY, data, BAND)).toBeUndefined()
  })

  test('a sub-minimum pair is hoverable across the bar it actually draws', () => {
    // Endpoints 1px apart draw as a 2.5px bar (ARC_FLAT_MIN_PX), centred on the
    // midpoint — so the drawn extent, not the genomic one, is what answers.
    const tiny = arcsData([
      { x1: 400, x2: 401, yBp: 40, shape: ARC_SHAPE_FLAT },
    ])
    expect(hitTestArcBand(401.6, flatY, tiny, BAND)?.index).toBe(0)
  })

  // The endpoint squares (arcMarker.slang) are the one mark in the band with no
  // hit test of its OWN. That is fine, and only because of an arithmetic
  // relationship no code states: a square reaches ARC_MARKER_PX/2 above and
  // below the bar's centre line, and the bar answers out to its own half-width
  // plus ARC_HIT_SLOP_PX — so the slop alone covers the square whatever the
  // configured width. Pin it, because the failure is silent: growing the square
  // past the slop leaves a rim of drawn, opaque, unhoverable pixels, which is
  // the "layer with no hit test" trap in a form no layer list would catch.
  test('the endpoint squares are covered by the bar that carries them', () => {
    expect(ARC_MARKER_PX / 2).toBeLessThanOrEqual(ARC_HIT_SLOP_PX)
    // And behaviourally, at the top corner of the square on the left endpoint.
    expect(
      hitTestArcBand(300, flatY - ARC_MARKER_PX / 2, data, BAND)?.index,
    ).toBe(0)
  })
})

// The scan skips any arc whose ink cannot reach the cursor's column before
// placing it, and the pad it allows has to be at least the reach the distance
// test itself grants — otherwise the prefilter, not the geometry, decides the
// edge of the target, and it does so silently: the arc simply stops answering a
// few px out from its own foot.
test('the column prefilter is wider than the reach of the ink it guards', () => {
  // Support 64 draws 4px of stroke (2 either side) and gets ARC_HIT_SLOP_PX on
  // top, so a foot answers ~5px outside its own endpoint — well past the
  // endpoint the prefilter bounds arcs by.
  const data = arcsData([{ x1: 200, x2: 600, yBp: 40, support: 64 }])
  const foot = BAND.arcsH - 1
  expect(hitTestArcBand(195.1, foot, data, BAND)?.index).toBe(0)
  // And it is a prefilter, not a widening: further out is still a miss.
  expect(hitTestArcBand(180, foot, data, BAND)).toBeUndefined()
})

// The pad is the WIDEST arc's reach — `ARC_WIDTH_MAX_SCALE` of the configured
// width — rather than each arc's own, so that the per-arc `arcLineWidth` (a
// `log2`) is spent only past the reject instead of on every arc in the feed. A
// hairline is therefore admitted several px further out than its ink reaches,
// and the geometry has to be what turns it down. This pins that: the extra
// tolerance is scan bookkeeping, not target.
test('a thin arc is not made hoverable by the pad the thickest one needs', () => {
  // A bar, so the distance is a subtraction rather than a conic. Support 1 draws
  // the configured 1px, so it answers 0.5 + ARC_HIT_SLOP_PX past its own end at
  // x=500 — while the pad admits it to the distance test out to 6.25.
  const data = arcsData([
    { x1: 300, x2: 500, yBp: 40, shape: ARC_SHAPE_FLAT, support: 1 },
  ])
  const flatY = BAND.arcsH - 40
  expect(hitTestArcBand(503.4, flatY, data, BAND)?.index).toBe(0)
  // Inside the pad, outside the ink's own reach.
  expect(hitTestArcBand(505.5, flatY, data, BAND)).toBeUndefined()
})

test('an empty feed answers nothing', () => {
  expect(hitTestArcBand(400, 50, emptyArcsUploadData(), BAND)).toBeUndefined()
})

test('a cursor outside the band is rejected before any arc is measured', () => {
  const data = arcsData([{ x1: 200, x2: 600, yBp: 40 }])
  expect(hitTestArcBand(400, -40, data, BAND)).toBeUndefined()
  expect(hitTestArcBand(400, BAND.arcsH + 40, data, BAND)).toBeUndefined()
})

// Interchromosomal connector ticks. Ink in the same rect as the arcs, drawn
// after them, and until this existed the one mark in the band that answered no
// hover at all — the "layer with no hit test" gap this display's CLAUDE.md
// names, and the sharpest instance of it, since a bare vertical at a locus is
// the mark whose meaning is least guessable from its shape.
interface TickSpec {
  bp: number
  support?: number
  partners?: string[]
}

// Ticks ONTO an existing feed, rather than a sibling builder returning a whole
// payload. `{...arcsData(…), ...ticksData(…)}` reads as a merge and is not one:
// both would start from `emptyArcsUploadData()`, so the second spread puts the
// empty arc arrays back and the case silently tests ticks alone.
function withTicks(base: ArcsUploadData, ticks: TickSpec[]): ArcsUploadData {
  return {
    ...base,
    arcLinePositions: new Uint32Array(ticks.map(t => t.bp)),
    arcLineSupport: new Uint32Array(ticks.map(t => t.support ?? 1)),
    arcLinePartnerRefNames: ticks.map(t => t.partners ?? ['chr2']),
    numArcLines: ticks.length,
  }
}

function ticksData(ticks: TickSpec[]): ArcsUploadData {
  return withTicks(emptyArcsUploadData(), ticks)
}

describe('a connector tick answers along its whole height', () => {
  const data = ticksData([{ bp: 400, support: 12, partners: ['chr7'] }])

  test.each([0, 50, BAND.arcsH])('at band y=%i', y => {
    // The tick spans the band, so Y is settled by the band gate alone and only
    // the horizontal distance decides — including exactly at both edges.
    expect(hitTestArcBand(400, y, data, BAND)?.kind).toBe('tick')
  })

  test('carries the count and the far-side chromosome the tooltip reports', () => {
    const hit = hitTestArcBand(400, 50, data, BAND)
    expect(hit).toEqual({
      kind: 'tick',
      index: 0,
      bp: 400,
      support: 12,
      partnerRefNames: ['chr7'],
    })
  })

  test('is reachable through the slop and not beyond it', () => {
    // Its own half-width plus the slop, the same tolerance an arc gets — and
    // grown by support the same way, since the tick is drawn at that width.
    const halfWidth = arcLineWidth(12, BAND.lineWidth) / 2
    expect(
      hitTestArcBand(400 + halfWidth + ARC_HIT_SLOP_PX - 0.1, 50, data, BAND)
        ?.kind,
    ).toBe('tick')
    expect(
      hitTestArcBand(400 + halfWidth + ARC_HIT_SLOP_PX + 1, 50, data, BAND),
    ).toBeUndefined()
  })
})

describe('a tick and an arc under one cursor', () => {
  // A dome from 200 to 600 rising 40, with a tick standing on its apex. Both
  // renderers paint the ticks BEFORE the arcs (`drawArcsPass` runs the line pass
  // first; `drawArcs` strokes the ticks before the curves), so where the two
  // overlap the arc is the ink actually on screen.
  const both = withTicks(
    arcsData([{ x1: 200, x2: 600, yBp: 40, support: 99 }]),
    [{ bp: 400 }],
  )
  // A point ON the drawn ellipse at a given screen x, so these cases do not
  // depend on a hand-computed y that would quietly stop being on the curve.
  const onCurveAt = (x: number) =>
    BAND.arcsH - 0.75 * 40 * Math.sqrt(Math.max(1 - ((x - 400) / 200) ** 2, 0))

  test('the arc wins, because it is the one painted on top', () => {
    // Support 1 on the tick against 99 on the arc, but this is paint order and
    // not a weight comparison: a tick of any weight would still lose here,
    // which is the point of drawing the interchromosomal claim underneath the
    // evidence rather than over it.
    expect(hitTestArcBand(400, onCurveAt(400), both, BAND)?.kind).toBe('arc')
  })

  test('a tick still answers where no arc is inked', () => {
    // Off the dome entirely but on the tick's own stroke: drawing the ticks
    // first must not make them unhoverable, only overdrawable.
    expect(hitTestArcBand(400, 5, both, BAND)?.kind).toBe('tick')
  })

  test('on-ink beats near-ink whichever family is which', () => {
    // Cursor inside the arc's own stroke and only NEAR the tick — the arc wins
    // here on both counts, so it is the converse below that carries the rule.
    const x = 400 + arcLineWidth(1, BAND.lineWidth) / 2 + 2
    expect(hitTestArcBand(x, onCurveAt(x), both, BAND)?.kind).toBe('arc')
  })

  // The case that makes the rule two-tier rather than "arc always": on the
  // tick's ink, merely NEAR the arc's. Paint order only decides between two
  // marks the cursor is equally on; it must not let the later family capture
  // hovers on the earlier one's actual stroke, which is the same asymmetry the
  // ticks used to be on the winning side of.
  test('a tick on ink beats an arc the cursor is only near', () => {
    const y =
      onCurveAt(400) + arcLineWidth(99, BAND.lineWidth) / 2 + ARC_HIT_SLOP_PX
    expect(hitTestArcBand(400, y, both, BAND)?.kind).toBe('tick')
  })
})
