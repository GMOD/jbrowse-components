import { render } from '@testing-library/react'

import { ColorBySwatch } from './ColorBySwatch.tsx'

test('renders a gradient swatch for a continuous mode', () => {
  const { container, getByText } = render(<ColorBySwatch colorBy="identity" />)
  getByText('0%')
  getByText('100%')
  const bar = container.querySelector('span[style*="linear-gradient"]')
  expect(bar).toBeTruthy()
})

test('renders empty for a per-name categorical mode', () => {
  const { container } = render(<ColorBySwatch colorBy="query" />)
  expect(container.querySelector('span[style*="gradient"]')).toBeNull()
})
