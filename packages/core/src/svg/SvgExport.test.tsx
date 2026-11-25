import { render } from '@testing-library/react'

import { PaletteProvider } from '../ui/PaletteContext.tsx'
import { resolvePalette } from '../ui/palette.ts'
import { SVGMessageBox } from './SvgExport.tsx'

function paint(element: Element) {
  return {
    color: element.getAttribute('fill'),
    opacity: Number(element.getAttribute('fill-opacity')),
  }
}

function drawnIn(mode: 'light' | 'dark') {
  const { container } = render(
    <PaletteProvider
      palette={resolvePalette({ configTheme: { palette: { mode } } })}
    >
      <svg>
        <SVGMessageBox message="Region too large" width={300} height={40} />
      </svg>
    </PaletteProvider>,
  )
  return {
    box: paint(container.querySelector('rect')!),
    text: paint(container.querySelector('text')!),
  }
}

test('the too-large note washes the text color over the background of the theme it exports in', () => {
  const light = drawnIn('light')
  const dark = drawnIn('dark')
  expect([light.box.color, light.text.color]).toEqual(['#000000', '#000000'])
  expect([dark.box.color, dark.text.color]).toEqual(['#ffffff', '#ffffff'])
  expect(light.box.opacity).toBeCloseTo(0.04, 2)
  expect(light.text.opacity).toBeCloseTo(0.6, 2)
  expect(dark.box.opacity).toBeCloseTo(0.08, 2)
  expect(dark.text.opacity).toBeCloseTo(0.7, 2)
})
