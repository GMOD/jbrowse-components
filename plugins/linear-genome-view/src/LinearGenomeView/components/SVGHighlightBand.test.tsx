import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import SVGHighlightBand, { spansAround } from './SVGHighlightBand.tsx'

function renderLabel() {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <SVGHighlightBand
          coords={{ left: 40, width: 100 }}
          height={200}
          gaps={[]}
          color="rgba(255,165,0,0.3)"
          label="Region of interest"
          labelColor="#000"
        />
      </svg>
    </ThemeProvider>,
  )
  return [...container.querySelectorAll('text')]
}

test('no gaps leaves the whole band', () => {
  expect(spansAround([], 100)).toEqual([{ top: 0, height: 100 }])
})

test('gaps are cut out, including ones touching either end', () => {
  expect(
    spansAround(
      [
        { top: 0, height: 10 },
        { top: 40, height: 20 },
        { top: 90, height: 10 },
      ],
      100,
    ),
  ).toEqual([
    { top: 10, height: 30 },
    { top: 60, height: 30 },
  ])
})

test('the label hangs from 2px down on a baseline written into y', () => {
  const texts = renderLabel()
  expect(texts).toHaveLength(2)
  for (const text of texts) {
    expect(text.getAttribute('y')).toBe('12')
    expect(text.hasAttribute('dominant-baseline')).toBe(false)
  }
})

test('the label carries a paper halo under its fill', () => {
  const [halo, fill] = renderLabel()
  expect(halo?.getAttribute('stroke')).toBe('#ffffff')
  expect(fill?.getAttribute('fill')).toBe('#000000')
  expect(fill?.hasAttribute('stroke')).toBe(false)
})
