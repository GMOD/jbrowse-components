import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'

import VariantTooltip from './VariantTooltip.tsx'

// BaseTooltip caps the box at 300px, so a value cell that cannot wrap runs a
// long line, a record's carriers, past the box's edge.
test('a long value wraps inside the tooltip box', () => {
  const carriers = '538 of 539 samples (100%), 2,663 no-call'
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <VariantTooltip
        source={{ featureName: 'HGSV_1823', carriers }}
        x={0}
        y={0}
      />
    </ThemeProvider>,
  )
  expect(getComputedStyle(screen.getByText(carriers)).whiteSpace).not.toBe(
    'nowrap',
  )
})

// a v4 `mouseover` or a `records.tooltip.field` jexl may return markup, which
// a feature track's tooltip renders
test('an HTML tooltip line renders as markup, not as its tags', async () => {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <VariantTooltip
        source={{ featureName: '<b>rs123</b><br/>Pathogenic' }}
        x={0}
        y={0}
      />
    </ThemeProvider>,
  )
  const bold = await screen.findByText('rs123')
  expect(bold.tagName).toBe('B')
  expect(screen.queryByText(/<b>/)).toBeNull()
})
