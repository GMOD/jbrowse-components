import { SimpleFeature } from '@jbrowse/core/util'
import { act, fireEvent, render } from '@testing-library/react'

import Arcs from '../LinearArcDisplay/components/Arcs.tsx'
import { createTestEnvironment } from './testEnv.ts'

// Both displays shade the arc under the mouse, and both take the color from
// `ArcsContainer` rather than resolving the theme per arc. What is worth pinning
// is the precedence the single-feature display adds on top: a selected arc is
// red, and stays red under the mouse rather than flipping to the hover color.
const { createDisplay } = createTestEnvironment({
  thickness: 2,
  label: 'arc',
  caption: 'arc',
})

function renderOneArc() {
  const { display, session } = createDisplay()
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'f1',
      refName: 'ctgA',
      start: 100,
      end: 2000,
      score: 10,
    }),
  ])
  const { container } = render(<Arcs model={display} />)
  return { path: container.querySelector('path')!, display, session }
}

test('the arc under the mouse takes the hover color, and gives it back', () => {
  const { path } = renderOneArc()
  const resting = path.getAttribute('stroke')

  fireEvent.mouseOver(path)
  const hovered = path.getAttribute('stroke')
  expect(hovered).not.toBe(resting)

  fireEvent.mouseLeave(path)
  expect(path.getAttribute('stroke')).toBe(resting)
})

test('a selected arc stays red under the mouse', () => {
  const { path, display, session } = renderOneArc()
  act(() => {
    session.setSelection(display.features![0]!)
  })
  expect(display.selectedFeatureId).toBe('f1')
  // `getStrokeProps` normalizes, so the literal 'red' the component writes
  // arrives as its hex
  expect(path.getAttribute('stroke')).toBe('#ff0000')

  fireEvent.mouseOver(path)
  expect(path.getAttribute('stroke')).toBe('#ff0000')
})
