import { drawSyntenyTrack } from './Canvas2DSyntenyRenderer.ts'
import { pickFeatureAtPoint } from './syntenyPickEngine.ts'
import { createGeometricPickCtx } from './testUtils.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { PickIndex } from './syntenyPickEngine.ts'
import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'

// The `perpW < 1` boundary is written twice: once in Canvas2DSyntenyRenderer
// (fill the silhouette, or stroke a 1px centerline) and once in
// syntenyPickEngine (pick the ribbon, or skip it). Both call the same
// `ribbonPerpWidth`, so what can drift is the *threshold* — and the renderer's
// own comment states the invariant the two together are supposed to guarantee:
//
//   "a ribbon is clickable exactly when it's drawn as a solid fill"
//
// Nothing asserted that. `syntenyPickEngine.test.ts` imports only the pick
// engine, and `Canvas2DSyntenyRenderer.test.ts` only the renderer, so moving
// one threshold and not the other produces ribbons you can see but not click
// (or click but not see) with every test still green. It is the last hand-sync
// site encoding a user-visible must-agree invariant rather than a deliberate
// per-backend divergence (adr-051). Deliberately not spelling the tag marker
// here: it is grepped to count the remaining sites, and prose about them should
// not inflate the count.
//
// This drives BOTH real implementations over the same geometry and compares
// their verdicts, rather than re-deriving the threshold here — a test that
// restated `< 1` would drift in exactly the way it is meant to catch.

// Records only which branch the renderer took: a filled silhouette or a
// stroked centerline.
function createDrawCtx() {
  let filled = 0
  let stroked = 0
  return {
    ctx: {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      bezierCurveTo() {},
      fill() {
        filled++
      },
      stroke() {
        stroked++
      },
      isPointInPath: () => false,
    },
    get filled() {
      return filled
    },
    get stroked() {
      return stroked
    },
  }
}

const HEIGHT = 100
const LEFT_BP = 100

// One ribbon whose top and bottom edges are both `widthBp` wide and vertically
// aligned, so at bpPerPx=1 the slope is zero and perpW is exactly `widthBp` px.
// That makes the sweep below a sweep over perpW itself.
function makeData(widthBp: number): SyntenyInstanceData {
  const right = LEFT_BP + widthBp
  return {
    bp1: Float32Array.from([LEFT_BP]),
    bp2: Float32Array.from([right]),
    bp3: Float32Array.from([right]),
    bp4: Float32Array.from([LEFT_BP]),
    base0: 0,
    base1: 0,
    colors: new Uint32Array([0xff808080]),
    kinds: new Uint8Array([0]),
    instanceFeatureIdx: new Uint32Array([0]),
    alignmentLengths: new Float32Array([10000]),
    instanceCount: 1,
  }
}

function makeParams(alpha = 1): SyntenyTrackRenderParams {
  return {
    yTop: 0,
    height: HEIGHT,
    alpha,
    fadeThinAlignments: true,
    minAlignmentLength: 0,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
    offsetPx0: 0,
    offsetPx1: 0,
    bpPerPx0: 1,
    bpPerPx1: 1,
    drawCurves: false,
  }
}

/** Did the renderer paint anything at all for this ribbon? */
function drawnMarks(widthBp: number, alpha?: number) {
  const rec = createDrawCtx()
  drawSyntenyTrack(rec.ctx, makeData(widthBp), makeParams(alpha), 800, 300)
  return rec
}

/** Did the renderer paint this ribbon as a solid fill? */
function isDrawnAsFill(widthBp: number) {
  const rec = drawnMarks(widthBp)
  expect(rec.filled + rec.stroked).toBe(1) // exactly one branch ran
  return rec.filled === 1
}

/** Does a click at the ribbon's center select it? */
function isPickable(widthBp: number, alpha?: number) {
  const state: SyntenyRenderState = {
    overdrawPx: 300,
    perTrack: new Map([[0, makeParams(alpha)]]),
  }
  const hit = pickFeatureAtPoint({
    ctx: createGeometricPickCtx(),
    state,
    regions: new Map([[0, makeData(widthBp)]]),
    pickIndices: new Map<number, PickIndex>(),
    canvasLogicalWidth: 800,
    x: LEFT_BP + widthBp / 2,
    y: HEIGHT / 2,
  })
  return hit !== undefined
}

// Straddles the boundary from well below to well above, including the exact
// 1px case — the one value where a `<` / `<=` slip shows up.
const WIDTHS = [0.1, 0.5, 0.9, 0.99, 1, 1.01, 1.1, 2, 10, 100]

test('a ribbon is pickable exactly when it is drawn as a solid fill', () => {
  for (const w of WIDTHS) {
    expect({ width: w, pickable: isPickable(w) }).toEqual({
      width: w,
      pickable: isDrawnAsFill(w),
    })
  }
})

test('the sweep actually crosses the boundary', () => {
  // Guards the test above from passing vacuously: if a refactor made every
  // ribbon fill (or every one stroke), the agreement assertion would still hold
  // while checking nothing.
  expect(WIDTHS.some(w => isDrawnAsFill(w))).toBe(true)
  expect(WIDTHS.some(w => !isDrawnAsFill(w))).toBe(true)
})

// The opacity slider reaches 0 (the settings menu's Opacity row bottoms out
// there), and the same "drawn and pickable are one boundary" rule has to
// survive the bottom of it. The pick used
// to weigh the packed byte alone, so a band faded to nothing kept every ribbon
// hoverable and clickable — a tooltip and a feature widget off a blank canvas.
// Well clear of the perpW gate at 10px wide, so the only thing varying is alpha.
const WIDE_BP = 10

test('a ribbon faded out of sight is not pickable either', () => {
  for (const alpha of [0, 0.001, 0.01]) {
    const rec = drawnMarks(WIDE_BP, alpha)
    expect({ alpha, marks: rec.filled + rec.stroked }).toEqual({
      alpha,
      marks: 0,
    })
    expect({ alpha, pickable: isPickable(WIDE_BP, alpha) }).toEqual({
      alpha,
      pickable: false,
    })
  }
})

test('an ordinary opacity still draws and still picks', () => {
  // Guards the above from passing vacuously, and pins that the floor sits well
  // below the 0.2 the view opens at.
  for (const alpha of [0.05, 0.2, 1]) {
    expect({ alpha, marks: drawnMarks(WIDE_BP, alpha).filled }).toEqual({
      alpha,
      marks: 1,
    })
    expect({ alpha, pickable: isPickable(WIDE_BP, alpha) }).toEqual({
      alpha,
      pickable: true,
    })
  }
})

test('sub-pixel ribbons are the unpickable ones, not the reverse', () => {
  // Pins the *direction*. Swapping the two branches would keep them in
  // agreement while making thin ribbons the only clickable ones.
  expect(isDrawnAsFill(0.5)).toBe(false)
  expect(isPickable(0.5)).toBe(false)
  expect(isDrawnAsFill(10)).toBe(true)
  expect(isPickable(10)).toBe(true)
})

// Everything above is a ribbon with zero slope, where the two draw modes trace
// the same shape and there is nothing for the curve to do. The boundary is NOT
// mode-independent, and that is where it went wrong: `ribbonPerpWidth` divides
// the widest edge by the CHORD's foreshortening, which on a bezier describes the
// ribbon nowhere — its tangent is vertical at both ends, so the widest point is
// foreshortened by nothing at all, and steepest at the middle.
//
// The ribbon below is 5px wide on both edges with 700px of travel over a 100px
// band. Straight, it really is 0.71px thick the whole way down. Curved, it is a
// 5px band at the top and bottom that pinches in the middle — which the GPU
// draws (perpCoverage measures the local width per fragment) and Canvas2D drew
// as a 1px hairline, unclickable, in the app and in the SVG export.
const SLOPED_W = 5
const SLOPED_TRAVEL = 700

function makeSlopedData(): SyntenyInstanceData {
  return {
    ...makeData(SLOPED_W),
    bp3: Float32Array.from([LEFT_BP + SLOPED_TRAVEL + SLOPED_W]),
    bp4: Float32Array.from([LEFT_BP + SLOPED_TRAVEL]),
  }
}

function slopedVerdicts(drawCurves: boolean) {
  const params = { ...makeParams(), drawCurves }
  const rec = createDrawCtx()
  drawSyntenyTrack(rec.ctx, makeSlopedData(), params, 800, 300)
  expect(rec.filled + rec.stroked).toBe(1)
  const hit = pickFeatureAtPoint({
    ctx: createGeometricPickCtx(),
    state: { overdrawPx: 300, perTrack: new Map([[0, params]]) },
    regions: new Map([[0, makeSlopedData()]]),
    pickIndices: new Map<number, PickIndex>(),
    canvasLogicalWidth: 800,
    // mid-height, where the ribbon's centre sits half its travel along
    x: LEFT_BP + SLOPED_TRAVEL / 2 + SLOPED_W / 2,
    y: HEIGHT / 2,
  })
  return { filled: rec.filled === 1, pickable: hit !== undefined }
}

test('a steep ribbon fills and picks when curved, and neither when straight', () => {
  expect(slopedVerdicts(true)).toEqual({ filled: true, pickable: true })
  expect(slopedVerdicts(false)).toEqual({ filled: false, pickable: false })
})

test('drawn and pickable stay one boundary in curve mode too', () => {
  for (const w of WIDTHS) {
    const params = { ...makeParams(), drawCurves: true }
    const rec = createDrawCtx()
    drawSyntenyTrack(rec.ctx, makeData(w), params, 800, 300)
    const hit = pickFeatureAtPoint({
      ctx: createGeometricPickCtx(),
      state: { overdrawPx: 300, perTrack: new Map([[0, params]]) },
      regions: new Map([[0, makeData(w)]]),
      pickIndices: new Map<number, PickIndex>(),
      canvasLogicalWidth: 800,
      x: LEFT_BP + w / 2,
      y: HEIGHT / 2,
    })
    expect({ width: w, pickable: hit !== undefined }).toEqual({
      width: w,
      pickable: rec.filled === 1,
    })
  }
})
