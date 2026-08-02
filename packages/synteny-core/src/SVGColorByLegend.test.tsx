import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import { SVGColorByLegend } from './SVGColorByLegend.tsx'
import { CIGAR_OP_I } from './colorLegend.ts'

// dotplot flavor (flat points, no CIGAR ops); the ribbon flavor is exercised
// separately below
function renderLegend(
  colorBy: Parameters<typeof SVGColorByLegend>[0]['colorBy'],
  alpha?: number,
) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <SVGColorByLegend
          colorBy={colorBy}
          viewWidth={800}
          alpha={alpha}
          pointBased
        />
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
  const { container } = renderLegend('strand', 0.6)
  // forward #f00 / reverse #00f at alpha 0.6 over white, not full saturation
  expect(container.querySelector('rect[fill="#ff6666"]')).toBeTruthy()
  expect(container.querySelector('rect[fill="#6666ff"]')).toBeTruthy()
  expect(container.querySelector('rect[fill="#ff0000"]')).toBeNull()
})

// Below legendChipColor's floor the match to the canvas is deliberately given
// up — see the on-screen legend's counterpart test.
test('a washed-out alpha is floored so the chip keeps its hue', () => {
  const { container } = renderLegend('strand', 0.2)
  expect(container.querySelector('rect[fill="#ffcccc"]')).toBeNull()
  expect(container.querySelector('rect[fill="#ff8c8c"]')).toBeTruthy()
})

test('chips are unblended at full alpha', () => {
  const { container } = renderLegend('strand')
  expect(container.querySelector('rect[fill="#ff0000"]')).toBeTruthy()
  expect(container.querySelector('rect[fill="#0000ff"]')).toBeTruthy()
})

// the ribbon (synteny) flavor lists the indel ops actually painted, exactly as
// the on-screen ColorByLegend does
test('ribbon mode lists the CIGAR indel chips it is handed', () => {
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <SVGColorByLegend
          colorBy="strand"
          viewWidth={800}
          cigarOps={CIGAR_OP_I}
        />
      </svg>
    </ThemeProvider>,
  )
  expect(container.textContent).toContain('insertion')
  expect(container.textContent).not.toContain('deletion')
})

// one chip per overlaid track, so a track-colored export can hand the legend
// more rows than the plot is tall
function renderTrackChips(count: number, maxHeight?: number) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <SVGColorByLegend
          colorBy="track"
          viewWidth={800}
          maxHeight={maxHeight}
          trackChips={Array.from({ length: count }, (_, i) => ({
            color: '#ff0000',
            label: `track ${i}`,
          }))}
        />
      </svg>
    </ThemeProvider>,
  )
}

test('chips past the plot height collapse into a summary row', () => {
  // 100px holds the title row plus 5 body rows, the last of which is the summary
  const { container } = renderTrackChips(10, 100)
  expect(container.textContent).toContain('track 3')
  expect(container.textContent).not.toContain('track 4')
  expect(container.textContent).toContain('+6 more')
  // the box grew to exactly the rows it drew, not the rows it was handed
  expect(container.querySelector('rect')?.getAttribute('height')).toBe('96')
})

test('an unbounded legend lists every chip', () => {
  const { container } = renderTrackChips(10)
  expect(container.textContent).toContain('track 9')
  expect(container.textContent).not.toContain('more')
})

// a band too short even for one chip still keys itself rather than collapsing
// to a bare title
test('a very short plot keeps one summary row', () => {
  const { container } = renderTrackChips(10, 20)
  expect(container.textContent).toContain('+10 more')
  expect(container.textContent).not.toContain('track 0')
})

test('categorical mode falls back to the per-sequence note', () => {
  const { container } = renderLegend('query')
  expect(container.textContent).toContain('Query name')
  expect(container.textContent).toContain('Distinct color per sequence')
  expect(container.querySelector('linearGradient')).toBeNull()
})
