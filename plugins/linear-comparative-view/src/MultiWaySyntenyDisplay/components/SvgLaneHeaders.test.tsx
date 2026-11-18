import { measureText } from '@jbrowse/core/util/measureText'
import { render, screen } from '@testing-library/react'

import { LABEL_FONT_SIZE } from '../laneHeader.ts'
import { SvgLaneHeaders } from './SvgLaneHeaders.tsx'

import type { LaneHeaderRow } from '../laneHeader.ts'

const row: LaneHeaderRow = {
  assemblyName: 'mate',
  label: `mate  ${'chr5:1,000,000..2,000,000  '.repeat(8)}`,
  scale: '1 Mb, squeezed 2×',
  y: 20,
  isAnchor: false,
  inline: false,
  changes: { text: '12 kb deletion', anchor: 'hg38' },
}

test('a long lane label ends in an ellipsis short of the changes chip in the SVG', () => {
  const { container } = render(
    <svg>
      <SvgLaneHeaders rows={[row]} width={400} />
    </svg>,
  )
  const label = [...container.querySelectorAll('text')].find(text =>
    text.textContent.startsWith('mate'),
  )!
  const chip = screen
    .getByTestId('multiway-lane-changes')
    .querySelector('rect')!
  expect(label.textContent).toMatch(/…$/)
  expect(
    Number(label.getAttribute('x')) +
      measureText(label.textContent, LABEL_FONT_SIZE),
  ).toBeLessThan(Number(chip.getAttribute('x')))
})
