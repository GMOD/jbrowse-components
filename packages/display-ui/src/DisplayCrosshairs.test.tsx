import { render } from '@testing-library/react'

import { DisplayCrosshairs } from './DisplayCrosshairs.tsx'

const model = {
  canvasWidthPx: 800,
  height: 200,
  sidebarBounds: { right: 64, top: 40 },
}

function verticalGuides(mouseX: number, mouseY?: number) {
  const { container } = render(
    <DisplayCrosshairs model={model} mouseX={mouseX} mouseY={mouseY} />,
  )
  return [...container.querySelectorAll('line')]
    .filter(line => line.getAttribute('x1') === line.getAttribute('x2'))
    .map(line => [line.getAttribute('y1'), line.getAttribute('y2')])
}

test('the vertical guide spans the track right of the sidebar', () => {
  expect(verticalGuides(300, 100)).toEqual([['0', '200']])
})

test('over the sidebar the vertical guide is dropped', () => {
  expect(verticalGuides(30, 100)).toEqual([])
})

test('over a band above the rows, left of the sidebar edge, the guide stops at the sidebar', () => {
  expect(verticalGuides(30, 10)).toEqual([['0', '40']])
})

test('a vertical-only guide left of the sidebar edge counts as in the rows', () => {
  expect(verticalGuides(30)).toEqual([])
})
