import { render } from '@testing-library/react'

import { SvgHaloText } from './FloatingText.tsx'

// The stroke copy inherits a fill otherwise, black by default, and a
// translucent label color drawn over that reads as black
test('the halo is a stroke copy that fills nothing, under the label', () => {
  const { container } = render(
    <svg>
      <SvgHaloText
        x={1}
        y={2}
        fill="rgba(0, 0, 0, 0.6)"
        halo="#fff"
        haloWidth={3}
        fontSize={9}
      >
        label
      </SvgHaloText>
    </svg>,
  )
  const [halo, label] = container.querySelectorAll('text')
  expect(halo?.getAttribute('fill')).toBe('none')
  expect(halo?.getAttribute('stroke')).toBe('#fff')
  expect(label?.getAttribute('fill')).toBe('rgba(0, 0, 0, 0.6)')
  expect(label?.getAttribute('stroke')).toBeNull()
})
