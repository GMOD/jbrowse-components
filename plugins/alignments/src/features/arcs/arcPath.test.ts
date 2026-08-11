import { arcScreenPath } from './arcPath.ts'
import { ARC_SHAPE_ARC, ARC_SHAPE_FLAT } from './compute.ts'
import { strokeArc } from './drawCanvas.ts'
import { emptyArcsUploadData } from './types.ts'

import type { ArcHitOptions } from './hitTest.ts'
import type { ArcsUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const BAND = {
  arcsTop: 0,
  arcsH: 100,
  pairedArcsDown: false,
  lineWidth: 1,
  screenWidthPx: 1000,
  // Arc mode: linear Y, and a domain that makes 1bp of yBp exactly 1px of rise.
  arcsYDomainBp: 92,
  arcsYLog: false,
  bpToScreenX: (bp: number) => bp,
} satisfies ArcHitOptions

function arcsData(
  arcs: { x1: number; x2: number; yBp: number; shape?: number }[],
): ArcsUploadData {
  return {
    ...emptyArcsUploadData(),
    arcX1: new Uint32Array(arcs.map(a => a.x1)),
    arcX2: new Uint32Array(arcs.map(a => a.x2)),
    arcYBp: new Uint32Array(arcs.map(a => a.yBp)),
    arcSupport: new Uint32Array(arcs.map(() => 1)),
    arcShapeTypes: new Uint8Array(arcs.map(a => a.shape ?? ARC_SHAPE_ARC)),
    arcColorTypes: new Uint8Array(arcs.map(() => 0)),
    numArcs: arcs.length,
  }
}

// The ellipse `strokeArc` hands to Canvas2D for the same inputs. Building the
// expected path out of THIS rather than out of a formula is the whole point: the
// two would otherwise be two placements of one arc, free to drift while each
// looks right alone — the same check `hitTest.test.ts` makes for the hover.
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

// Foot to foot over the apex, as the drawn ellipse defines those.
function expectedCurve(
  e: { cx: number; cy: number; rx: number; ry: number },
  sweep: number,
) {
  return `M ${e.cx - e.rx} ${e.cy} A ${e.rx} ${e.ry} 0 0 ${sweep} ${e.cx + e.rx} ${e.cy}`
}

describe('a curved pair traces the ellipse Canvas2D is given', () => {
  test.each([
    ['a near pair, which is the dome branch', 200, 600, 40, 1000],
    ['a far pair, which is the semicircle branch', 200, 600, 40, 100],
    ['a far pair with a millions-of-px radius', 0, 4_000_000, 40, 800],
  ])('%s', (_name, x1, x2, yBp, screenWidthPx) => {
    const opts = { ...BAND, screenWidthPx }
    // yBp maps 1:1 to px of rise here, and the band points up, so the anchor is
    // the band bottom and the apex sits yBp above it.
    const drawn = drawnEllipse(
      x1,
      x2,
      BAND.arcsH,
      BAND.arcsH - yBp,
      false,
      screenWidthPx,
    )
    expect(arcScreenPath(arcsData([{ x1, x2, yBp }]), 0, opts)).toBe(
      expectedCurve(drawn, 1),
    )
  })
})

test('a down-pointing band anchors at the band top and sweeps the other way', () => {
  const down = { ...BAND, pairedArcsDown: true }
  const drawn = drawnEllipse(
    200,
    600,
    BAND.arcsTop,
    BAND.arcsTop + 40,
    true,
    1000,
  )
  expect(
    arcScreenPath(arcsData([{ x1: 200, x2: 600, yBp: 40 }]), 0, down),
  ).toBe(expectedCurve(drawn, 0))
})

describe('a read-cloud flat line traces the bar it paints', () => {
  test('across the pair, at the Y its insert size plots to', () => {
    const data = arcsData([
      { x1: 300, x2: 500, yBp: 40, shape: ARC_SHAPE_FLAT },
    ])
    expect(arcScreenPath(data, 0, BAND)).toBe(
      `M 300 ${BAND.arcsH - 40} L 500 ${BAND.arcsH - 40}`,
    )
  })

  test('a sub-minimum pair traces the full minimum bar, centred', () => {
    // Endpoints 1px apart draw as an ARC_FLAT_MIN_PX bar about the midpoint —
    // the drawn extent, not the genomic one, which is also what answers a hover.
    const data = arcsData([
      { x1: 400, x2: 401, yBp: 40, shape: ARC_SHAPE_FLAT },
    ])
    const [, x1, , x2] = /^M (\S+) (\S+) L (\S+) (\S+)$/.exec(
      arcScreenPath(data, 0, BAND),
    )!
    expect((Number(x1) + Number(x2)) / 2).toBeCloseTo(400.5)
    expect(Number(x2) - Number(x1)).toBeGreaterThan(1)
  })
})
