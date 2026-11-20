import { ExportFontFamilyContext } from '@jbrowse/core/svg/constants'
import { render } from '@testing-library/react'

import ScoreDomainCaption from './ScoreDomainCaption.tsx'

// A monospace face advances every glyph 0.6em, where the Helvetica table puts
// the caption's `[`, `,` and `.` at 0.28em: measured there, a monospace
// caption ran out of its backdrop and past the right edge it was aligned to
test('an export in monospace backs and right-aligns the caption in that face', () => {
  const canvasWidth = 400
  const { container } = render(
    <svg>
      <ExportFontFamilyContext value="monospace">
        <ScoreDomainCaption
          domain={[0.25, 1.5]}
          scaleType="linear"
          canvasWidth={canvasWidth}
        />
      </ExportFontFamilyContext>
    </svg>,
  )
  const text = container.querySelector('text')!
  const drawnRight =
    Number(text.getAttribute('x')) + text.textContent.length * 0.6 * 12
  const backdrop = container.querySelector('rect')!
  expect(drawnRight).toBeLessThanOrEqual(canvasWidth)
  expect(drawnRight).toBeLessThanOrEqual(
    Number(backdrop.getAttribute('x')) + Number(backdrop.getAttribute('width')),
  )
})
