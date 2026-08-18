import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import {
  makeTestPalette,
  makeTestRenderState,
} from '../../LinearAlignmentsDisplay/testUtils.ts'
import { drawOverlaps } from './drawCanvas.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

// The two layouts that put more than one feature on a row mean different things
// by an overlap, so this pass draws them differently — and the branch is the
// thing worth pinning, because both forms are a rect of the same geometry and
// only the paint says which claim is being made. See overlap.slang.
const palette = makeTestPalette({ colorOverlap: [0.2, 0.2, 0.2] })

// bpLength 100 over fullBlockWidth px; featureHeight 10 at row 0 puts the rect
// at y=0, so every assertion below is about the fill and not the geometry.
function draw(
  spans: [number, number][],
  state: Partial<RenderState>,
  fullBlockWidth = 1000,
) {
  const ctx = new SvgCanvas()
  const block: DrawBlock = { start: 0, end: 100, screenStartPx: 0 }
  drawOverlaps(
    ctx,
    {
      overlapPositions: Uint32Array.from(spans.flat()),
      overlapYs: new Uint16Array(spans.length),
    },
    block,
    100,
    fullBlockWidth,
    makeTestRenderState({ colors: palette, featureSpacing: 0, ...state }),
  )
  return ctx.getSerializedSvg()
}

const opacityOf = (svg: string) =>
  Number(/fill-opacity="([\d.]+)"/.exec(svg)?.[1])

// 40bp at 10px/bp is 400px wide, past FADE_HI_PX, so the mark is at full
// strength and the fill is exactly what the palette holds.
const WIDE: [number, number][] = [[10, 50]]

test('chain mode fills with the neutral, opaquely', () => {
  const svg = draw(WIDE, { chainMode: true })
  expect(svg).toContain('fill="rgb(51,51,51)"')
  // no fill-opacity attribute at all: an alpha here would composite the fill
  // back over whichever arm drew last, which is the reading the neutral exists
  // to remove
  expect(svg).not.toContain('fill-opacity')
})

test('collapsed rows keep the stacking dark tint', () => {
  const svg = draw(WIDE, { collapseGroupRows: true })
  expect(svg).toContain('fill="rgb(0,0,0)"')
  // OVERLAP_ALPHA comes back through the generated twin as the float32 it is in
  // the shader, so this is 0.4000000059604645 on the nose
  expect(opacityOf(svg)).toBeCloseTo(0.4, 6)
})

test('a narrow overlap fades in rather than popping', () => {
  // 1bp at 10px/bp sits between the two fade bounds
  const opacity = opacityOf(draw([[10, 11]], { chainMode: true }))
  expect(opacity).toBeGreaterThan(0)
  expect(opacity).toBeLessThan(1)
})

test('and below the fade floor nothing is painted at all', () => {
  // 40bp at 0.03px/bp is 1.2px, under FADE_LO_PX
  expect(draw(WIDE, { chainMode: true }, 3)).not.toContain('<rect')
})

test('sub-3px rows draw nothing in either layout', () => {
  for (const state of [{ chainMode: true }, { collapseGroupRows: true }]) {
    expect(draw(WIDE, { ...state, featureHeight: 2 })).not.toContain('<rect')
  }
})

// The other half of `shouldDrawOverlaps`, and the half only this test sees: the
// renderer reaches this pass through a PILEUP_LAYERS entry gated on the same
// predicate, so a regression here is invisible from there. One feature per row
// means an overlap span is a read overlapping itself, and painting it reads as
// depth that isn't there.
test('and neither layout means nothing to draw at any height', () => {
  expect(draw(WIDE, {})).not.toContain('<rect')
})
