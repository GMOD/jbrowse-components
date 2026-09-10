import { render } from '@testing-library/react'

import SkippedFeaturesIndicator, {
  skippedFeatures,
} from './SkippedFeaturesIndicator.tsx'

test('sums each layer over the regions and names the fields that skipped', () => {
  expect(
    skippedFeatures([
      [
        { count: 3, skipped: 2, field: 'score' },
        { count: 5, skipped: 0, field: undefined },
      ],
      [
        { count: 4, skipped: 1, field: 'score' },
        { count: 5, skipped: 0, field: undefined },
      ],
    ]),
  ).toEqual({ skipped: 3, total: 10, fields: ['score'] })
})

test('a feature every layer skips is one feature', () => {
  expect(
    skippedFeatures([
      [
        { count: 0, skipped: 4, field: 'pval' },
        { count: 0, skipped: 4, field: 'beta' },
      ],
    ]),
  ).toEqual({ skipped: 4, total: 4, fields: ['pval', 'beta'] })
})

test('nothing skipped renders nothing', () => {
  const { container } = render(
    <SkippedFeaturesIndicator skipped={0} total={12} fields={[]} />,
  )
  expect(container.innerHTML).toBe('')
})

test('the chip counts the skips and the tooltip names the field', () => {
  const { getByTestId } = render(
    <SkippedFeaturesIndicator skipped={4} total={4} fields={['pval']} />,
  )
  const chip = getByTestId('track-control-filter')
  expect(chip.textContent).toContain('4 of 4 skipped')
  expect(chip.getAttribute('aria-label')).toBe(
    '4 of 4 features skipped: `pval` missing or not a number',
  )
})
