import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, render } from '@testing-library/react'

import ArcHoverOverlay from './ArcHoverOverlay.tsx'

import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { ArcHighlight } from './arcHitTest.ts'

afterEach(cleanup)

function renderOverlay(hoveredArcHighlight: ArcHighlight | undefined) {
  const model = {
    id: 'display1',
    height: 200,
    hoveredArcHighlight,
  } as unknown as LinearAlignmentsDisplayModel
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ArcHoverOverlay model={model} />
    </ThemeProvider>,
  )
  return container
}

// A block that does NOT start at the canvas origin, which is the case the
// horizontal clip exists for — a multi-region view, or a region panned so its
// block covers only part of the track.
const HIGHLIGHT = {
  d: 'M 200 100 A 200 30 0 0 1 600 100',
  clip: { x: 150, y: 20, width: 500, height: 80 },
  lineWidth: 2,
}

test('nothing is drawn when the cursor is on no arc', () => {
  expect(renderOverlay(undefined).querySelector('svg')).toBeNull()
})

test('the arc is traced by the path the hover resolved', () => {
  const path = renderOverlay(HIGHLIGHT).querySelector('path')!
  expect(path.getAttribute('d')).toBe(HIGHLIGHT.d)
  // Never thinner than the arc's own ink, or a heavy arc would look marked by a
  // second, finer curve lying alongside it.
  expect(Number(path.getAttribute('stroke-width'))).toBeGreaterThan(
    HIGHLIGHT.lineWidth,
  )
})

test('the mark is clipped to the arc band, as the arc pass is', () => {
  // A far pair's semicircle rises hundreds of px above a band tens of px tall,
  // and the renderers clip it — so without this the highlight would trace a
  // curve across the coverage histogram that no arc was painted on.
  const container = renderOverlay(HIGHLIGHT)
  const rect = container.querySelector('clipPath rect')!
  expect(rect.getAttribute('y')).toBe(String(HIGHLIGHT.clip.y))
  expect(rect.getAttribute('height')).toBe(String(HIGHLIGHT.clip.height))
  expect(container.querySelector('path')!.getAttribute('clip-path')).toContain(
    container.querySelector('clipPath')!.id,
  )
})

test('and to the block, which the arc pass is also scissored to', () => {
  // The same argument turned sideways: that semicircle runs `rx` px to either
  // side of its midpoint, so a cross-region or off-screen-mate arc leaves
  // through the block's EDGE rather than its ceiling. The renderers cut it there
  // (GPU `scissorX`/`scissorW`, Canvas2D `ctx.rect(scissorX, …, scissorW, …)`);
  // a full-width clip let the highlight run on across the next region.
  const rect = renderOverlay(HIGHLIGHT).querySelector('clipPath rect')!
  expect(rect.getAttribute('x')).toBe(String(HIGHLIGHT.clip.x))
  expect(rect.getAttribute('width')).toBe(String(HIGHLIGHT.clip.width))
})

test('the overlay never takes the pointer', () => {
  const svg = renderOverlay(HIGHLIGHT).querySelector('svg')!
  expect(getComputedStyle(svg).pointerEvents).toBe('none')
})
