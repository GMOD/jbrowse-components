import { fireEvent, render } from '@testing-library/react'

import { createTestEnvironment } from '../testEnv.ts'
import HicOverlayPanel from './HicOverlayPanel.tsx'
import { INSTANCE_STRIDE_WORDS } from './shaders/hic.iface.generated.ts'

import type { HicDataResult } from '../../RenderHicDataRPC/types.ts'

// One contact, which is all `hasLegendData` needs: a positive `maxScore` is the
// whole gate on the color key.
const DATA: HicDataResult = {
  instances: new Float32Array(INSTANCE_STRIDE_WORDS),
  numContacts: 1,
  maxScore: 20,
  percentile95: 20,
  binWidth: 4,
  originBp: 0,
  resolution: 1000,
  appliedNormalization: 'KR',
  regions: [
    {
      refName: 'ctgA',
      dataXStart: 0,
      dataXEnd: 256,
      combinedOffset: 0,
      reversed: false,
    },
  ],
  pairRuns: [{ region1Idx: 0, region2Idx: 0, start: 0, end: 1 }],
}

const { createDisplay } = createTestEnvironment()

function renderLegend() {
  const { display } = createDisplay()
  display.setRpcData(DATA)
  display.setShowLegend(true)
  expect(display.showLegendArea).toBe(true)
  return { display, ...render(<HicOverlayPanel model={display} />) }
}

// The color key is `FloatingLegend`'s box now, not a hand-rolled MUI panel, so
// the on-screen dismiss is the same `×` `HicSVGColorLegend` draws into an
// exported figure.
test('the legend is the shared floating box', () => {
  const { getByTestId } = renderLegend()
  expect(getByTestId('floating-legend')).toBeTruthy()
})

test('the dismiss control is a plain × that turns the legend off', () => {
  const { display, getByLabelText } = renderLegend()
  const close = getByLabelText('Hide legend')
  expect(close.tagName).toBe('BUTTON')
  expect(close.textContent).toBe('×')

  fireEvent.click(close)
  expect(display.showLegend).toBe(false)
})

test('the gradient bar rides along as the box body', () => {
  const { getByTestId } = renderLegend()
  const bar = getByTestId('floating-legend').querySelector<HTMLElement>(
    '[style*="linear-gradient"]',
  )
  expect(bar).toBeTruthy()
})
