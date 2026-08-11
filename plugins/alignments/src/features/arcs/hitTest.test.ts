import { ARC_SHAPE_ARC, ARC_SHAPE_FLAT } from './compute.ts'
import { strokeArc } from './drawCanvas.ts'
import { ARC_HIT_SLOP_PX, hitTestArcs } from './hitTest.ts'
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
    arcSupport: new Uint32Array(arcs.map(a => a.support ?? 1)),
    arcShapeTypes: new Uint8Array(arcs.map(a => a.shape ?? ARC_SHAPE_ARC)),
    arcColorTypes: new Uint8Array(arcs.map(a => a.colorType ?? 0)),
    numArcs: arcs.length,
  }
}

// The ellipse `strokeArc` actually hands to Canvas2D for these inputs. Sampling
// the hit test against THIS rather than against a re-derivation is the whole
// point: the two would otherwise be two placements of the same arc, free to
// disagree while both look right on their own.
function drawnEllipse(
  sx1: number,
  sx2: number,
  anchorY: number,
  apexY: number,
  down: boolean,
  screenWidthPx: number,
) {
  let call: { cx: number; cy: number; rx: number; ry: number } | undefined
  const ctx = {
    beginPath: () => {},
    stroke: () => {},
    ellipse: (cx: number, cy: number, rx: number, ry: number) => {
      call = { cx, cy, rx, ry }
    },
  } as unknown as Ctx2D
  strokeArc(ctx, sx1, sx2, anchorY, apexY, down, screenWidthPx)
  return call!
}

// Points on the drawn half-ellipse, at the canvas angles strokeArc sweeps.
function pointsOnDrawnCurve(
  sx1: number,
  sx2: number,
  yBp: number,
  down = false,
  screenWidthPx = BAND.screenWidthPx,
) {
  const anchorY = down ? BAND.arcsTop : BAND.arcsTop + BAND.arcsH
  const apexY = down ? anchorY + yBp : anchorY - yBp
  const e = drawnEllipse(sx1, sx2, anchorY, apexY, down, screenWidthPx)
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
      expect(hitTestArcs(p.x, p.y, data, BAND)?.index).toBe(0)
    }
  })

  test('a point well off the curve is not', () => {
    // Inside the dome, halfway up the middle — the arc is a stroke, not a fill,
    // so the enclosed area must not answer.
    expect(hitTestArcs(400, 80, data, BAND)).toBeUndefined()
    // Outside the span entirely.
    expect(hitTestArcs(50, 100, data, BAND)).toBeUndefined()
  })

  test('the far side of the anchor line is not a hit', () => {
    // The apex points up, so below the baseline is blank band. The stroke does
    // not reach there either: at the feet the curve is vertical, so its stroke
    // runs out sideways rather than down.
    const foot = 200
    expect(hitTestArcs(foot, BAND.arcsH + 1, data, BAND)?.index).toBe(0)
    expect(
      hitTestArcs(foot, BAND.arcsH + ARC_HIT_SLOP_PX + 4, data, BAND),
    ).toBeUndefined()
  })
})

test('a down-pointing band mirrors, and hits the curve it draws', () => {
  const down = { ...BAND, pairedArcsDown: true }
  const data = arcsData([{ x1: 200, x2: 600, yBp: 40 }])
  for (const p of pointsOnDrawnCurve(200, 600, 40, true)) {
    expect(hitTestArcs(p.x, p.y, data, down)?.index).toBe(0)
  }
  // Above the anchor (which is the band TOP here) is the blank side.
  expect(hitTestArcs(400, -6, data, down)).toBeUndefined()
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
    expect(hitTestArcs(p.x, p.y, data, far)?.index).toBe(0)
  }
  // The legs rise AT the endpoints, so the middle of the span is empty even
  // though the pair spans it.
  expect(hitTestArcs(400, 60, data, far)).toBeUndefined()
})

test('a far pair with a millions-of-px radius still resolves its legs', () => {
  // The case distToWideCirclePx exists for: `length(p - c) - r` cancels away
  // every significant digit at this radius, so a naive distance answers noise.
  const far = { ...BAND, screenWidthPx: 800 }
  const data = arcsData([{ x1: 0, x2: 4_000_000, yBp: 40 }])
  // Just outside the left endpoint's leg, a few px up the band.
  expect(hitTestArcs(0, BAND.arcsH - 20, data, far)?.index).toBe(0)
  // Ten px to the left of that leg is off it.
  expect(hitTestArcs(-10, BAND.arcsH - 20, data, far)).toBeUndefined()
})

describe('support widens the target the way it widens the ink', () => {
  const thin = arcsData([{ x1: 200, x2: 600, yBp: 40, support: 1 }])
  const thick = arcsData([{ x1: 200, x2: 600, yBp: 40, support: 64 }])

  test('a thick arc answers where a hairline does not', () => {
    // Straight up from the apex, past the slop a support-1 arc gets.
    const apexY = BAND.arcsH - 0.75 * 40
    const y = apexY - (ARC_HIT_SLOP_PX + 2)
    expect(hitTestArcs(400, y, thin, BAND)).toBeUndefined()
    expect(hitTestArcs(400, y, thick, BAND)?.index).toBe(0)
  })

  test('the hit carries the support count, which is what the tooltip reports', () => {
    expect(hitTestArcs(400, BAND.arcsH - 0.75 * 40, thick, BAND)?.support).toBe(
      64,
    )
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
  expect(hitTestArcs(low.x, low.y, data, BAND)?.index).toBe(0)
  expect(hitTestArcs(high.x, high.y, data, BAND)?.index).toBe(1)
})

describe('read-cloud flat lines', () => {
  const data = arcsData([
    { x1: 300, x2: 500, yBp: 40, shape: ARC_SHAPE_FLAT, support: 3 },
  ])
  const flatY = BAND.arcsH - 40

  test('answers along the bar and not above it', () => {
    expect(hitTestArcs(300, flatY, data, BAND)?.index).toBe(0)
    expect(hitTestArcs(400, flatY, data, BAND)?.index).toBe(0)
    expect(hitTestArcs(500, flatY, data, BAND)?.index).toBe(0)
    expect(hitTestArcs(400, flatY - 12, data, BAND)).toBeUndefined()
  })

  test('does not answer past the ends of the bar', () => {
    expect(hitTestArcs(520, flatY, data, BAND)).toBeUndefined()
  })

  test('a sub-minimum pair is hoverable across the bar it actually draws', () => {
    // Endpoints 1px apart draw as a 2.5px bar (ARC_FLAT_MIN_PX), centred on the
    // midpoint — so the drawn extent, not the genomic one, is what answers.
    const tiny = arcsData([
      { x1: 400, x2: 401, yBp: 40, shape: ARC_SHAPE_FLAT },
    ])
    expect(hitTestArcs(401.6, flatY, tiny, BAND)?.index).toBe(0)
  })
})

test('an empty feed answers nothing', () => {
  expect(hitTestArcs(400, 50, emptyArcsUploadData(), BAND)).toBeUndefined()
})

test('a cursor outside the band is rejected before any arc is measured', () => {
  const data = arcsData([{ x1: 200, x2: 600, yBp: 40 }])
  expect(hitTestArcs(400, -40, data, BAND)).toBeUndefined()
  expect(hitTestArcs(400, BAND.arcsH + 40, data, BAND)).toBeUndefined()
})
