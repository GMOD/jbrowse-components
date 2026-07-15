import { render } from '@testing-library/react'

import MultiSampleVariantRowColors from './MultiSampleVariantRowColors.tsx'
import configFactory from '../../LinearMultiSampleVariantDisplay/configSchema.ts'
import stateModelFactory from '../../LinearMultiSampleVariantDisplay/model.ts'

// Regression guard for the fit-mode sidebar labels. In the default
// fit-to-display-height mode (rowHeight 0) the row-color/label overlay used to
// read the raw `rowHeight` (0), so its virtual window collapsed to slice(0,0)
// and no per-sample labels rendered. It must read `effectiveRowHeight` so the
// rows resolve to a real height and the labels appear. (The other multi-sample
// fixture has 1094 samples, where rows are sub-pixel and labels are correctly
// culled — so only a small-sample render exercises this path.)
function createDisplay() {
  const configSchema = configFactory()
  return stateModelFactory(configSchema).create({
    type: 'LinearMultiSampleVariantDisplay',
    configuration: configSchema.create({
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 'test',
    }),
  })
}

test('sidebar sample labels render in fit mode', () => {
  const m = createDisplay()
  m.setSources([{ name: 'HG001' }, { name: 'HG002' }, { name: 'HG003' }])

  // preconditions: default fit mode, few rows so each is tall enough to label
  expect(m.rowHeight).toBe(0)
  expect(m.effectiveRowHeight).toBeGreaterThanOrEqual(6)
  expect(m.canDisplayLabels).toBe(true)

  // the overlay nests this in an <svg>; mirror that so the SVG children render
  // in the right namespace
  const { getByText } = render(
    <svg>
      <MultiSampleVariantRowColors model={m} />
    </svg>,
  )
  getByText('HG001')
  getByText('HG002')
  getByText('HG003')
})
