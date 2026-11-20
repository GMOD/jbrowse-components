import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import { ConnectorLabels } from './VariantLabels.tsx'

test('a rotated SNP id is centred on its connector by y alone', () => {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <ConnectorLabels coords={[{ mx: 0, gx: 40, label: 'rs123' }]} />
      </svg>
    </ThemeProvider>,
  )
  const text = container.querySelector('text')
  expect(text?.hasAttribute('dominant-baseline')).toBe(false)
  expect(text?.getAttribute('transform')).toBe('rotate(-90, 40, 0)')
  expect(Number(text?.getAttribute('y'))).toBeCloseTo(2.8, 6)
})
