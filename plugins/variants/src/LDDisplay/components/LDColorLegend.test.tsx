import { render } from '@testing-library/react'

import LDColorLegend from './LDColorLegend.tsx'

// The on-screen legend is a plain positioned box in the display's own tree, not
// portaled into the track overlay node, so the node's `data-gesture-owner` does
// not reach it — it has to carry its own or a drag across the ramp's labels
// pans the LGV underneath instead of selecting them.
test('claims its own press, so a drag on the ramp labels does not pan', () => {
  const { container } = render(
    <LDColorLegend ldMetric="r2" idSuffix="test-display" />,
  )

  const label = [...container.querySelectorAll('text')].find(
    t => t.textContent === 'R²',
  )!
  expect(label.closest('[data-gesture-owner]')).not.toBeNull()
})
