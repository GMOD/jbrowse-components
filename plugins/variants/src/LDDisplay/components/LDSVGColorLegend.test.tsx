import {
  GRADIENT_LEGEND_SVG_AREA_WIDTH,
  GRADIENT_LEGEND_WIDTH,
} from '@jbrowse/core/ui'
import { render } from '@testing-library/react'

import LDSVGColorLegend from './LDSVGColorLegend.tsx'

function legendTransform(positionOutside: boolean) {
  const { container } = render(
    <svg>
      <LDSVGColorLegend
        ldMetric="r2"
        width={500}
        positionOutside={positionOutside}
      />
    </svg>,
  )
  return container.querySelector('g')!.getAttribute('transform')
}

test('floats over the plot when the container reserves no legend area', () => {
  expect(legendTransform(false)).toBe('translate(370, 10)')
})

test('parks beside the plot when the container reserves a legend area', () => {
  expect(legendTransform(true)).toBe('translate(510, 10)')
  // svgLegendWidth() reserves enough for the 10px gap plus the whole box
  expect(510 + GRADIENT_LEGEND_WIDTH).toBeLessThanOrEqual(
    500 + GRADIENT_LEGEND_SVG_AREA_WIDTH,
  )
})
