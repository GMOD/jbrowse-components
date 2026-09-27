import { render } from '@testing-library/react'

import ChromeHighlight from './ChromeHighlight.tsx'

import type { HighlightHost } from './highlightHost.ts'

// A link's box is mostly empty space under its curve, so a rect carrying the
// stroke lights the curve, clipped to the box, and every other rect a box.
test('a rect with a stroke draws its path in the box, the canvas origin where the stroke says', () => {
  const model = {
    hoverInk: [
      {
        left: 10,
        top: 5,
        width: 100,
        height: 50,
        stroke: {
          d: 'M10 40A50 30 0 0 1 110 40',
          widthPx: 2,
          originX: 0,
          originY: 20,
        },
      },
      { left: 0, top: 0, width: 4, height: 4 },
    ],
  } as unknown as HighlightHost
  const { getAllByTestId } = render(<ChromeHighlight model={model} />)
  const [curve, box] = getAllByTestId('chrome-hover')
  expect(curve!.tagName).toBe('svg')
  expect(curve!.style.overflow).toBe('hidden')
  const path = curve!.querySelector('path')!
  expect(path.getAttribute('d')).toBe('M10 40A50 30 0 0 1 110 40')
  expect(path.getAttribute('transform')).toBe('translate(-8.5 16.5)')
  expect(curve!.style.left).toBe('8.5px')
  expect(curve!.style.width).toBe('103px')
  expect(path.getAttribute('stroke-width')).toBe('5')
  expect(box!.tagName).toBe('DIV')
})
