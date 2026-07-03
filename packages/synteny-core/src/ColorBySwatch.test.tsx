import { render } from '@testing-library/react'

import { ColorBySwatch } from './ColorBySwatch.tsx'

test('renders a gradient swatch for a continuous mode', () => {
  const { container, getByText } = render(<ColorBySwatch colorBy="identity" />)
  getByText('0%')
  getByText('100%')
  const bar = container.querySelector('span[style*="linear-gradient"]')
  expect(bar).toBeTruthy()
})

test('renders a color chip per op for a structural mode', () => {
  const { container } = render(<ColorBySwatch colorBy="default" />)
  // match/insertion/deletion/skip, each a titled swatch square
  expect(container.querySelectorAll('span[title]')).toHaveLength(4)
})

test('renders empty for a per-name categorical mode', () => {
  const { container } = render(<ColorBySwatch colorBy="query" />)
  expect(container.querySelector('span[style*="gradient"]')).toBeNull()
})
