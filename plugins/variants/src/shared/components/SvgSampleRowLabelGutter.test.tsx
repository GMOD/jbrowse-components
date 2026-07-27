import { render } from '@testing-library/react'

import configFactory from '../../LinearMultiSampleVariantDisplay/configSchema.ts'
import stateModelFactory from '../../LinearMultiSampleVariantDisplay/model.ts'
import SvgSampleRowLabelGutter from './SvgSampleRowLabelGutter.tsx'
import { getMaxLabelWidth } from './SvgSampleRowLabels.tsx'

import type { Source } from '../types.ts'

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
      <SvgSampleRowLabelGutter model={m} />
    </svg>,
  )
  getByText('HG001')
  getByText('HG002')
  getByText('HG003')
})

describe('getMaxLabelWidth', () => {
  const sources: Source[] = [
    { name: 'a', color: '#a' },
    { name: 'bb', color: '#b' },
  ]

  it('is 0 when there are no sources', () => {
    expect(
      getMaxLabelWidth({
        sources: undefined,
        fontSize: 12,
        canDisplayLabels: true,
      }),
    ).toBe(0)
    expect(
      getMaxLabelWidth({ sources: [], fontSize: 12, canDisplayLabels: true }),
    ).toBe(0)
  })

  it('uses the fixed swatch width when labels are hidden', () => {
    expect(
      getMaxLabelWidth({ sources, fontSize: 12, canDisplayLabels: false }),
    ).toBe(20)
  })

  it('measures labels (plus padding) when labels are shown', () => {
    expect(
      getMaxLabelWidth({ sources, fontSize: 12, canDisplayLabels: true }),
    ).toBeGreaterThanOrEqual(10)
  })
})
