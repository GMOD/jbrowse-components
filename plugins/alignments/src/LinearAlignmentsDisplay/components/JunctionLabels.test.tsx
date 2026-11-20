import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import JunctionLabels from './JunctionLabels.tsx'

function renderTexts() {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <JunctionLabels labels={[{ key: 'j1', x: 100, y: 20, count: 42 }]} />
      </svg>
    </ThemeProvider>,
  )
  return [...container.querySelectorAll('text')]
}

test('a count is centred on its apex by y alone', () => {
  const texts = renderTexts()
  expect(texts).toHaveLength(2)
  for (const text of texts) {
    expect(text.hasAttribute('dominant-baseline')).toBe(false)
    expect(Number(text.getAttribute('y'))).toBeCloseTo(23.06, 6)
  }
})

test('the halo is a stroked copy under the fill, not paint-order', () => {
  const [halo, fill] = renderTexts()
  expect(halo?.getAttribute('stroke')).toBe('#fff')
  expect(halo?.getAttribute('stroke-width')).toBe('2.5')
  expect(fill?.hasAttribute('stroke')).toBe(false)
  expect(fill?.hasAttribute('paint-order')).toBe(false)
})
