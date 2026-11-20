import { measureText } from '@jbrowse/core/util/measureText'
import { render, screen } from '@testing-library/react'

import { BADGE_PAD_PX, LABEL_FONT_SIZE } from '../laneHeader.ts'
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

// What Noto Sans, the sans-serif rsvg and Inkscape resolve on Linux, sets
// against measureText's table: up to 8% wider at regular weight and 13% at
// semibold. A box sized to the table had the badge's text on its border and
// "gaps" running out of the changes chip into the scale.
const NOTO_REGULAR = 1.085
const NOTO_SEMIBOLD = 1.13

const wide = {
  ...row,
  label: 'hg38 chr17:43,044,295..43,125,483 · also on chr9',
  against: 'CHM13v2.0',
  scale: '81,189 bp',
  changes: { text: '3 inversions, 2 gaps', anchor: 'CHM13v2.0' },
  color: '#e41a1c',
}

function drawWide() {
  const { container } = render(
    <svg>
      <SvgLaneHeaders rows={[wide]} width={360} />
    </svg>,
  )
  const rectBox = (rect: Element) => ({
    left: Number(rect.getAttribute('x')),
    right: Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')),
  })
  const texts = [...container.querySelectorAll('text')]
  const byText = (t: string) => texts.find(text => text.textContent === t)!
  return {
    container,
    rectBox,
    badgeText: byText('vs CHM13v2.0'),
    badgeRect: container.querySelector('g > rect')!,
    changes: screen.getByTestId('multiway-lane-changes'),
    labelChip: screen
      .getByTestId('multiway-lane-color-chip')
      .querySelector('rect')!,
  }
}

test('the badge box holds its semibold text in a wider face, centred', () => {
  const { badgeText, badgeRect, rectBox } = drawWide()
  const box = rectBox(badgeRect)
  const ink = measureText('vs CHM13v2.0', LABEL_FONT_SIZE) * NOTO_SEMIBOLD
  expect(badgeText.getAttribute('font-weight')).toBe('600')
  expect(badgeText.getAttribute('text-anchor')).toBe('middle')
  expect(Number(badgeText.getAttribute('x'))).toBeCloseTo(
    (box.left + box.right) / 2,
  )
  expect(box.right - box.left - ink).toBeGreaterThanOrEqual(BADGE_PAD_PX)
})

test('the changes chip holds its text in a wider face and clears the scale', () => {
  const { changes, rectBox } = drawWide()
  const box = rectBox(changes.querySelector('rect')!)
  const text = changes.querySelector('text')!
  const ink =
    measureText('3 inversions, 2 gaps', LABEL_FONT_SIZE) * NOTO_REGULAR
  expect(text.getAttribute('text-anchor')).toBe('middle')
  expect(Number(text.getAttribute('x'))).toBeCloseTo((box.left + box.right) / 2)
  expect(box.right - box.left).toBeGreaterThan(ink)
  const scaleLeft =
    360 - 2 - measureText('81,189 bp', LABEL_FONT_SIZE) * NOTO_REGULAR
  expect(scaleLeft - box.right).toBeGreaterThan(2)
})

test('the cut lane label stays inside its chip and short of the changes chip in a wider face', () => {
  const { container, changes, labelChip, rectBox } = drawWide()
  const label = [...container.querySelectorAll('text')].find(text =>
    text.textContent.startsWith('hg38'),
  )!
  const labelRight =
    Number(label.getAttribute('x')) +
    measureText(label.textContent, LABEL_FONT_SIZE) * NOTO_REGULAR
  expect(label.textContent).toMatch(/…$/)
  expect(labelRight).toBeLessThanOrEqual(rectBox(labelChip).right)
  expect(labelRight).toBeLessThan(rectBox(changes.querySelector('rect')!).left)
})
