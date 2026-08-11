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

const HIGHLIGHT = {
  d: 'M 200 100 A 200 30 0 0 1 600 100',
  clipTop: 20,
  clipHeight: 80,
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
  expect(rect.getAttribute('y')).toBe(String(HIGHLIGHT.clipTop))
  expect(rect.getAttribute('height')).toBe(String(HIGHLIGHT.clipHeight))
  expect(container.querySelector('path')!.getAttribute('clip-path')).toContain(
    container.querySelector('clipPath')!.id,
  )
})

test('the overlay never takes the pointer', () => {
  const svg = renderOverlay(HIGHLIGHT).querySelector('svg')!
  expect(getComputedStyle(svg).pointerEvents).toBe('none')
})
