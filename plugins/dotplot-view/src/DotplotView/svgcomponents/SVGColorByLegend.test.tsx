import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import { SVGColorByLegend } from './SVGColorByLegend.tsx'

function renderLegend(
  colorBy: Parameters<typeof SVGColorByLegend>[0]['colorBy'],
  alpha?: number,
) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <SVGColorByLegend colorBy={colorBy} viewWidth={800} alpha={alpha} />
      </svg>
    </ThemeProvider>,
  )
}

test('ramp mode emits a gradient with stops', () => {
  const { container } = renderLegend('identity')
  expect(container.textContent).toContain('Identity')
  expect(container.querySelector('linearGradient')).toBeTruthy()
  expect(container.querySelectorAll('stop')).toHaveLength(9)
  expect(container.querySelector('rect[fill^="url(#"]')).toBeTruthy()
})

test('chips mode emits one swatch per chip', () => {
  const { container } = renderLegend('strand')
  expect(container.textContent).toContain('Strand')
  expect(container.textContent).toContain('forward')
  expect(container.textContent).toContain('reverse')
  // dotplot strand legend has no CIGAR indel chips
  expect(container.textContent).not.toContain('insertion')
})

// The exported points are drawn at the display's alpha, so a full-saturation
// chip would key the plot wrong — same rule the on-screen ColorByLegend follows.
test('chips blend over white by the display alpha', () => {
  const { container } = renderLegend('strand', 0.2)
  // forward #f00 / reverse #00f at alpha 0.2 over white, not full saturation
  expect(container.querySelector('rect[fill="#ffcccc"]')).toBeTruthy()
  expect(container.querySelector('rect[fill="#ccccff"]')).toBeTruthy()
  expect(container.querySelector('rect[fill="#ff0000"]')).toBeNull()
})

test('chips are unblended at full alpha', () => {
  const { container } = renderLegend('strand')
  expect(container.querySelector('rect[fill="#ff0000"]')).toBeTruthy()
  expect(container.querySelector('rect[fill="#0000ff"]')).toBeTruthy()
})

test('categorical mode falls back to the per-sequence note', () => {
  const { container } = renderLegend('query')
  expect(container.textContent).toContain('Query name')
  expect(container.textContent).toContain('Distinct color per sequence')
  expect(container.querySelector('linearGradient')).toBeNull()
})
