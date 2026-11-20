import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { ThemeProvider } from '@mui/material/styles'
import { render } from '@testing-library/react'

import HatchCircle from './HatchCircle.tsx'

test('each message line is centred on its row by y alone', () => {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <HatchCircle
          radius={100}
          fill="#eee"
          hatchColor="#ccc"
          textLine={1}
          text="Loading"
          textRotationDeg={0}
        />
      </svg>
    </ThemeProvider>,
  )
  const text = container.querySelector('text')
  expect(text?.hasAttribute('dominant-baseline')).toBe(false)
  expect(Number.parseFloat(text?.getAttribute('y') ?? '')).toBeCloseTo(3.28, 6)
  expect(text?.getAttribute('y')).toMatch(/em$/)
})
