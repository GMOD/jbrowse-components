import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import { paintArcBand } from '../LinearAlignmentsDisplay/renderers/arcMarks.ts'
import { makeTestRenderState } from '../LinearAlignmentsDisplay/testUtils.ts'
import { arcMarkScreenPath } from '../features/arcs/arcPath.ts'
import { arcsToRegionResult } from '../features/arcs/arcRegions.ts'
import { arcMarkFrom } from '../features/arcs/mark.ts'
import { ARC_SHAPE_FLAT_SPLIT } from '../features/arcs/shapes.ts'
import {
  ARC_FLAT_DASH_PX,
  ARC_FLAT_GAP_PX,
} from './slang/arcFlat.consts.generated.ts'
import * as glsl from './slang/arcFlat.glsl.generated.ts'
import * as wgsl from './slang/arcFlat.wgsl.generated.ts'

import type { ComputedArc } from '../features/arcs/arcTypes.ts'
import type { ArcBandFrame } from '../features/arcs/mark.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'
import type {
  BpRegionBounds,
  RenderBlock,
} from '@jbrowse/render-core/renderBlock'

/**
 * Where a split-read connector's dash pattern starts: the line's SCREEN-LEFT
 * end, on all three backends.
 *
 * Canvas2D and SVG get that for free — both begin the path at `mid - halfPx`,
 * and `setLineDash` / `stroke-dasharray` start the pattern at the path's first
 * point, so it rides with the line. The GPU pass has to choose a coordinate,
 * and it dashed off the fragment's band x: an origin on the viewport, which a
 * single-region view pins to screen x 0 and leaves there, so the pattern stood
 * still while the line moved under it.
 */

const VIEW_W = 800
const BP_LEN = 10_000
const X1 = 1000
const X2 = 5000

const BLOCK: RenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: BP_LEN,
  screenStartPx: 0,
  screenEndPx: VIEW_W,
  reversed: false,
}

const BAND: Omit<ArcBandFrame, 'bpToScreenX'> = {
  arcsYDomainBp: 1000,
  arcsYLog: false,
  arcsTop: 0,
  arcsH: 40,
  pairedArcsDown: false,
  viewWidthPx: VIEW_W,
}

function bar(reversed: boolean) {
  const bounds: BpRegionBounds = { ...BLOCK, reversed }
  const toX = makeBpMapper(bounds)
  const mark = arcMarkFrom(
    { sx1: toX(X1), sx2: toX(X2), yBp: 500, shapeType: ARC_SHAPE_FLAT_SPLIT },
    BAND,
  )
  if (mark.kind !== 'bar') {
    throw new Error('expected a flat connector')
  }
  return mark
}

// Where the painter put the pen down, and what pattern was set when it did.
function paintedDash() {
  const strokes: { from: number; dash: number[] }[] = []
  let dash: number[] = []
  let from = Number.NaN
  const ctx = {
    set strokeStyle(_v: string) {},
    set fillStyle(_v: string) {},
    set lineWidth(_v: number) {},
    setLineDash(d: number[]) {
      dash = [...d]
    },
    beginPath() {},
    moveTo(x: number) {
      from = x
    },
    lineTo() {},
    ellipse() {},
    stroke() {
      strokes.push({ from, dash })
    },
    fillRect() {},
  } as unknown as MarkContext2D
  const arc: ComputedArc = {
    p1: { refName: 'chr1', bp: X1 },
    p2: { refName: 'chr1', bp: X2 },
    colorType: 0,
    shapeType: ARC_SHAPE_FLAT_SPLIT,
    yBp: 500,
    spanBp: 500,
    support: 1,
    key: 'k',
  }
  paintArcBand(ctx, arcsToRegionResult([arc], []), BLOCK, {
    ...makeTestRenderState({
      canvasWidth: VIEW_W,
      arcsYDomainBp: 1000,
      readConnectionsLineWidth: 1,
    }),
    arcBand: { top: 0, height: 40, down: false },
  })
  return strokes
}

test('Canvas2D starts the dashed line at its screen-left end', () => {
  // The origin the GPU coordinate is chosen to match, and the one the test
  // below cannot see. A painter that moved to the other end would put the
  // three backends out of phase with nothing in tree to notice.
  const mark = bar(false)
  const [stroke] = paintedDash()
  expect(stroke!.dash).toEqual([ARC_FLAT_DASH_PX, ARC_FLAT_GAP_PX])
  expect(stroke!.from).toBeCloseTo(mark.mid - mark.halfPx, 10)
  expect(stroke!.from).toBeCloseTo(Math.min(mark.sx1, mark.sx2), 10)
})

test.each([false, true])(
  'SVG writes that same first point (reversed=%s)',
  reversed => {
    const mark = bar(reversed)
    expect(arcMarkScreenPath(mark)).toBe(
      `M ${mark.mid - mark.halfPx} ${mark.markY} L ${mark.mid + mark.halfPx} ${mark.markY}`,
    )
    expect(mark.mid - mark.halfPx).toBeCloseTo(Math.min(mark.sx1, mark.sx2), 10)
  },
)

/** The varyings the fragment stage declares, by name, sorted. */
function fragmentInputs(src: string, backend: 'wgsl' | 'glsl') {
  if (backend === 'wgsl') {
    const body = /struct pixelInput_0\s*\{([^}]*)\}/.exec(src)![1]!
    return [...body.matchAll(/(\w+?)_\d+\s*:/g)].map(m => m[1]!).sort()
  }
  return [...src.matchAll(/^(?:flat )?in \w+ v_(\w+);/gm)]
    .map(m => m[1]!)
    .sort()
}

test.each([
  ['wgsl' as const, wgsl.WGSL_SOURCE],
  ['glsl' as const, glsl.GLSL_FRAGMENT],
])('%s hands the fragment no canvas position to dash from', (backend, src) => {
  // The property, rather than the expression that expresses it: with only
  // these four varyings the fragment CANNOT dash off the canvas, whatever
  // arithmetic it uses, and a re-added band-x varying fails here under any
  // name it is given. `local` is the offset from the line's centre.
  expect(fragmentInputs(src, backend)).toEqual([
    'dashed',
    'halfLen',
    'halfWidthPx',
    'local',
  ])
  // And it does dash, off the flip that turns `local.x` into a distance from
  // the screen-left end. Not matched as one expression: slangc is free to
  // hoist the argument into a temp.
  expect(src).toContain('dashCoverage_0(')
  expect(src).toContain('arcFlipX_0(')
})
