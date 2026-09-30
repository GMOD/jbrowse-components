import { createMafTestEnvironment } from './testEnv.ts'

// The row under the pointer reaches session.hovered through `hoveredFeature`,
// which is how a graph track in the same view learns which sample it names
function hovering() {
  const { display, view } = createMafTestEnvironment().createDisplay()
  display.setHoveredFeature({ name: 'panTro4' })
  expect(display.hoveredFeature).toEqual({ name: 'panTro4' })
  return { display, view }
}

test('moving within one row writes nothing', () => {
  const { display } = hovering()
  const first = display.hoveredFeature
  display.setHoveredFeature({ name: 'panTro4' })
  expect(display.hoveredFeature).toBe(first)
  display.setHoveredFeature({ name: 'mm10' })
  expect(display.hoveredFeature).toEqual({ name: 'mm10' })
})

test('a zoom clears the row', () => {
  const { display, view } = hovering()
  view.zoomTo(view.bpPerPx * 2)
  expect(display.hoveredFeature).toBeUndefined()
})

test('a pan clears the row', () => {
  const { display, view } = hovering()
  view.horizontalScroll(100)
  expect(display.hoveredFeature).toBeUndefined()
})
